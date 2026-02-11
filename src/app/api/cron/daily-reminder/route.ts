import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// VAPID 설정
webpush.setVapidDetails(
  'mailto:admin@hazel.local',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

// Cron 보안: CRON_SECRET으로 인증
function verifyCronAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;

  // Vercel Cron은 자동으로 Authorization 헤더를 붙임
  // 로컬 테스트용 fallback
  if (process.env.NODE_ENV === 'development') return true;
  return false;
}

interface SubscriptionRow {
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseInstance = ReturnType<typeof createClient<any>>;

/** 모든 활성 구독에 푸시 전송, 실패 구독 비활성화 */
async function sendToAllSubscriptions(
  supabase: SupabaseInstance,
  payload: string,
): Promise<{ sent: number; failed: number }> {
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('is_active', true);

  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const subs = subscriptions as unknown as SubscriptionRow[];

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh || '', auth: sub.auth || '' },
        },
        payload,
      ),
    ),
  );

  const failedEndpoints = subs
    .filter((_, i) => results[i]?.status === 'rejected')
    .map((s) => s.endpoint);

  if (failedEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .update({ is_active: false } as never)
      .in('endpoint', failedEndpoints);
  }

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return { sent, failed: failedEndpoints.length };
}

/**
 * 매일 오전 8시(KST) 실행 - 오늘 예약 리마인드 + 사전 리마인더 알림
 * Vercel Cron: vercel.json에서 schedule 설정
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Service role key로 Supabase 접근 (RLS 우회)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    // 오늘 날짜 (KST 기준)
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(now.getTime() + kstOffset);
    const today = kstDate.toISOString().split('T')[0];

    let totalSent = 0;
    let totalFailed = 0;

    // ── 1. 오늘 예약 리마인더 ────────────────────────────────
    const { data: todayReservations, error: resError } = await supabase
      .from('reservations')
      .select('id, title, customer_name, time, estimated_amount, status')
      .eq('date', today)
      .neq('status', 'cancelled')
      .order('time', { nullsFirst: false });

    if (resError) {
      console.error('Failed to fetch reservations:', resError);
      return NextResponse.json({ error: resError.message }, { status: 500 });
    }

    if (todayReservations && todayReservations.length > 0) {
      const count = todayReservations.length;
      const summaryLines = todayReservations.slice(0, 3).map((r) => {
        const time = r.time ? r.time.slice(0, 5) : '--:--';
        return `${time} ${r.title}${r.customer_name ? ` (${r.customer_name})` : ''}`;
      });

      let body = summaryLines.join('\n');
      if (count > 3) {
        body += `\n외 ${count - 3}건`;
      }

      const payload = JSON.stringify({
        title: `오늘 예약 ${count}건`,
        body,
        tag: `daily-reminder-${today}`,
        url: '/calendar',
        requireInteraction: false,
      });

      const result = await sendToAllSubscriptions(supabase, payload);
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    // ── 2. 사전 리마인더 (reminder_date = 오늘) ─────────────
    const { data: reminderReservations, error: reminderError } = await supabase
      .from('reservations')
      .select('id, title, customer_name, date, time, estimated_amount')
      .eq('reminder_date', today)
      .neq('status', 'cancelled')
      .neq('status', 'completed')
      .order('date');

    if (reminderError) {
      console.error('Failed to fetch reminder reservations:', reminderError);
    }

    if (reminderReservations && reminderReservations.length > 0) {
      for (const r of reminderReservations) {
        const resDate = r.date;
        const daysUntil = Math.ceil(
          (new Date(resDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24),
        );

        const dateLabel =
          daysUntil === 0
            ? '오늘'
            : daysUntil === 1
              ? '내일'
              : `${daysUntil}일 후`;

        const body = [
          `${dateLabel} (${resDate})`,
          r.time ? `시간: ${r.time.slice(0, 5)}` : null,
          r.customer_name ? `고객: ${r.customer_name}` : null,
          r.estimated_amount ? `금액: ${new Intl.NumberFormat('ko-KR').format(r.estimated_amount)}원` : null,
        ]
          .filter(Boolean)
          .join('\n');

        const payload = JSON.stringify({
          title: `예약 리마인더: ${r.title}`,
          body,
          tag: `reminder-${r.id}`,
          url: '/calendar',
          requireInteraction: true,
        });

        const result = await sendToAllSubscriptions(supabase, payload);
        totalSent += result.sent;
        totalFailed += result.failed;
      }

      // 전송 완료된 리마인더의 reminder_date를 null로 초기화 (중복 전송 방지)
      const reminderIds = reminderReservations.map((r) => r.id);
      await supabase
        .from('reservations')
        .update({ reminder_date: null })
        .in('id', reminderIds);
    }

    return NextResponse.json({
      message: 'Daily reminder sent',
      today_reservations: todayReservations?.length || 0,
      advance_reminders: reminderReservations?.length || 0,
      sent: totalSent,
      failed: totalFailed,
    });
  } catch (error) {
    console.error('Daily reminder error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

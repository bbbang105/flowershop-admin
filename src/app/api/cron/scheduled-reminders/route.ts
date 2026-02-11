import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// VAPID 설정
webpush.setVapidDetails(
  'mailto:admin@hazel.local',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

function verifyCronAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  if (process.env.NODE_ENV === 'development') return true;
  return false;
}

interface SubscriptionRow {
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
}

/**
 * 매시간 실행 - 사용자가 설정한 시간에 예약 리마인더 푸시 전송
 * reminder_at이 현재 시각 ~ 1시간 전 범위에 있는 예약을 찾아 전송
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    // 현재 시각 기준 1시간 윈도우 (KST)
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // reminder_at이 지난 1시간 이내인 미완료/미취소 예약 조회
    const { data: reminders, error: reminderError } = await supabase
      .from('reservations')
      .select('id, title, customer_name, date, time, estimated_amount')
      .lte('reminder_at', now.toISOString())
      .gt('reminder_at', oneHourAgo.toISOString())
      .neq('status', 'cancelled')
      .neq('status', 'completed')
      .order('date');

    if (reminderError) {
      console.error('Failed to fetch scheduled reminders:', reminderError);
      return NextResponse.json({ error: reminderError.message }, { status: 500 });
    }

    if (!reminders || reminders.length === 0) {
      return NextResponse.json({ message: 'No scheduled reminders', sent: 0 });
    }

    // 활성 구독 조회
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('is_active', true);

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: 'No active subscriptions', sent: 0 });
    }

    const subs = subscriptions as unknown as SubscriptionRow[];
    let totalSent = 0;
    let totalFailed = 0;

    // KST 기준 오늘 날짜
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(now.getTime() + kstOffset);
    const today = kstDate.toISOString().split('T')[0];

    for (const r of reminders) {
      const daysUntil = Math.ceil(
        (new Date(r.date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24),
      );

      const dateLabel =
        daysUntil <= 0
          ? '오늘'
          : daysUntil === 1
            ? '내일'
            : `${daysUntil}일 후`;

      const body = [
        `${dateLabel} (${r.date})`,
        r.time ? `시간: ${r.time.slice(0, 5)}` : null,
        r.customer_name ? `고객: ${r.customer_name}` : null,
        r.estimated_amount
          ? `금액: ${new Intl.NumberFormat('ko-KR').format(r.estimated_amount)}원`
          : null,
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

      totalSent += results.filter((r) => r.status === 'fulfilled').length;
      totalFailed += failedEndpoints.length;
    }

    // 전송 완료된 리마인더 초기화 (중복 방지)
    const reminderIds = reminders.map((r) => r.id);
    await supabase
      .from('reservations')
      .update({ reminder_at: null } as never)
      .in('id', reminderIds);

    return NextResponse.json({
      message: 'Scheduled reminders sent',
      reminders: reminders.length,
      sent: totalSent,
      failed: totalFailed,
    });
  } catch (error) {
    console.error('Scheduled reminders error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

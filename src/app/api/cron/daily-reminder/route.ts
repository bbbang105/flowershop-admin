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

/**
 * 매일 오전 8시(KST) 실행 - 오늘 예약 리마인드 알림
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

    // 오늘 예약 조회 (취소 제외)
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('id, title, customer_name, time, estimated_amount, status')
      .eq('date', today)
      .neq('status', 'cancelled')
      .order('time', { nullsFirst: false });

    if (resError) {
      console.error('Failed to fetch reservations:', resError);
      return NextResponse.json({ error: resError.message }, { status: 500 });
    }

    if (!reservations || reservations.length === 0) {
      return NextResponse.json({ message: 'No reservations today', sent: 0 });
    }

    // 알림 메시지 구성
    const count = reservations.length;
    const summaryLines = reservations.slice(0, 3).map((r) => {
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

    // 모든 활성 구독에 전송
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('is_active', true);

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: 'No active subscriptions', sent: 0 });
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

    // 실패한 구독 비활성화
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

    return NextResponse.json({
      message: 'Daily reminder sent',
      reservations: count,
      sent,
      failed: failedEndpoints.length,
    });
  } catch (error) {
    console.error('Daily reminder error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

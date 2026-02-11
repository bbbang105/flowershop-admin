'use server';

import webpush from 'web-push';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-guard';
import { withErrorLogging } from '@/lib/errors';
import { reportError } from '@/lib/logger';

// VAPID 설정 (lazy 초기화 - 빌드 시 환경변수 없을 수 있음)
let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error('VAPID 키가 설정되지 않았습니다');
  webpush.setVapidDetails('mailto:admin@hazel.local', publicKey, privateKey);
  vapidConfigured = true;
}

// ─── 타입 ──────────────────────────────────────────────────────

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface NotificationPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  requireInteraction?: boolean;
}

// 영구적 실패 상태코드 (구독 비활성화 대상)
const PERMANENT_FAILURE_CODES = new Set([404, 410]);

/** 엔드포인트 종류 식별 */
function getEndpointType(endpoint: string): string {
  if (endpoint.includes('apple.com')) return 'Apple';
  if (endpoint.includes('fcm.googleapis.com')) return 'FCM';
  if (endpoint.includes('mozilla.com')) return 'Mozilla';
  return 'Unknown';
}

/** webpush 에러에서 상세 정보 추출 */
function extractPushError(error: unknown): { statusCode: number; body: string; message: string } {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const e = error as { statusCode: number; body?: string; message?: string };
    return {
      statusCode: e.statusCode,
      body: typeof e.body === 'string' ? e.body.slice(0, 500) : '',
      message: e.message || 'Unknown WebPushError',
    };
  }
  return {
    statusCode: 0,
    body: '',
    message: error instanceof Error ? error.message : String(error),
  };
}

/** 푸시 전송 결과 처리: 로깅 + 영구 실패만 비활성화 */
async function processPushResults(
  subscriptions: { endpoint: string }[],
  results: PromiseSettledResult<webpush.SendResult>[],
  supabase: Awaited<ReturnType<typeof createClient>>,
  context: string,
): Promise<{ sent: number; failed: number; errorDetail: string }> {
  const permanentFailEndpoints: string[] = [];
  const errorMessages: string[] = [];
  let failCount = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i]!;
    const sub = subscriptions[i]!;
    const endpointType = getEndpointType(sub.endpoint);

    if (result.status === 'rejected') {
      failCount++;
      const errorInfo = extractPushError(result.reason);
      const msg = `${endpointType}(${errorInfo.statusCode}): ${errorInfo.message}`;
      errorMessages.push(msg);

      console.error(
        `[Push] ${context} 전송 실패 [${endpointType}]`,
        `status=${errorInfo.statusCode}`,
        `body=${errorInfo.body}`,
        `message=${errorInfo.message}`,
      );

      if (PERMANENT_FAILURE_CODES.has(errorInfo.statusCode)) {
        permanentFailEndpoints.push(sub.endpoint);
      }
    }
  }

  // 영구 실패 구독만 비활성화
  if (permanentFailEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .in('endpoint', permanentFailEndpoints);
    console.log(`[Push] ${permanentFailEndpoints.length}개 구독 비활성화 (영구 실패)`);
  }

  // 실패 시 Discord 리포트
  if (errorMessages.length > 0) {
    await reportError(
      new Error(`푸시 전송 실패 (${context})\n${errorMessages.join('\n')}`),
      { action: `push:${context}` },
    );
  }

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return { sent, failed: failCount, errorDetail: errorMessages.join(', ') };
}

// ─── 푸시 구독 ─────────────────────────────────────────────────

async function _subscribeToPush(
  subscription: PushSubscriptionData,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  const supabase = await createClient();

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  );

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export const subscribeToPush = withErrorLogging('subscribeToPush', _subscribeToPush);

// ─── 푸시 구독 해제 ────────────────────────────────────────────

async function _unsubscribeFromPush(
  endpoint: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  const supabase = await createClient();

  const { error } = await supabase
    .from('push_subscriptions')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('endpoint', endpoint);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export const unsubscribeFromPush = withErrorLogging('unsubscribeFromPush', _unsubscribeFromPush);

// ─── 구독 상태 확인 ────────────────────────────────────────────

async function _getPushSubscriptionStatus(): Promise<{
  success: boolean;
  isSubscribed: boolean;
}> {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1);

  return { success: true, isSubscribed: (data?.length || 0) > 0 };
}

export const getPushSubscriptionStatus = withErrorLogging(
  'getPushSubscriptionStatus',
  _getPushSubscriptionStatus,
);

// ─── 푸시 전송 (내부용) ────────────────────────────────────────

async function _sendPushToUser(
  userId: string,
  payload: NotificationPayload,
): Promise<{ success: boolean; sent: number; failed: number; errorDetail?: string }> {
  ensureVapid();
  const supabase = await createClient();

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!subscriptions || subscriptions.length === 0) {
    console.log('[Push] sendPushToUser: 활성 구독 없음', { userId });
    return { success: true, sent: 0, failed: 0, errorDetail: '활성 구독이 없습니다' };
  }

  console.log(`[Push] sendPushToUser: ${subscriptions.length}개 구독 발견`, {
    endpoints: subscriptions.map((s) => getEndpointType(s.endpoint)),
  });

  const payloadStr = JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag || 'hazel',
    url: payload.url || '/',
    requireInteraction: payload.requireInteraction || false,
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh || '', auth: sub.auth || '' },
        },
        payloadStr,
      ),
    ),
  );

  const { sent, failed, errorDetail } = await processPushResults(
    subscriptions,
    results,
    supabase,
    'sendPushToUser',
  );

  return { success: true, sent, failed, errorDetail: errorDetail || undefined };
}

export const sendPushToUser = withErrorLogging('sendPushToUser', _sendPushToUser);

// ─── 모든 활성 유저에게 전송 ───────────────────────────────────

async function _sendPushToAllUsers(
  payload: NotificationPayload,
): Promise<{ success: boolean; sent: number; failed: number }> {
  ensureVapid();
  const supabase = await createClient();

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('is_active', true);

  if (!subscriptions || subscriptions.length === 0) {
    console.log('[Push] sendPushToAllUsers: 활성 구독 없음');
    return { success: true, sent: 0, failed: 0 };
  }

  console.log(`[Push] sendPushToAllUsers: ${subscriptions.length}개 구독 발견`, {
    endpoints: subscriptions.map((s) => getEndpointType(s.endpoint)),
  });

  const payloadStr = JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag || 'hazel',
    url: payload.url || '/',
    requireInteraction: payload.requireInteraction || false,
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh || '', auth: sub.auth || '' },
        },
        payloadStr,
      ),
    ),
  );

  const { sent, failed } = await processPushResults(
    subscriptions,
    results,
    supabase,
    'sendPushToAllUsers',
  );

  return { success: true, sent, failed };
}

export const sendPushToAllUsers = withErrorLogging('sendPushToAllUsers', _sendPushToAllUsers);

// ─── 테스트 알림 전송 ──────────────────────────────────────────

async function _sendTestNotification(): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  const result = await _sendPushToUser(user.id, {
    title: '테스트 알림',
    body: '푸시 알림이 정상적으로 작동합니다!',
    tag: 'test',
    url: '/settings',
  });

  if (result.sent === 0) {
    const errorMsg = result.errorDetail || '활성 구독이 없습니다';
    console.error('[Push] 테스트 알림 실패:', errorMsg);
    return { success: false, error: errorMsg };
  }

  console.log(`[Push] 테스트 알림 성공: ${result.sent}건 전송, ${result.failed}건 실패`);
  return { success: true };
}

export const sendTestNotification = withErrorLogging('sendTestNotification', _sendTestNotification);

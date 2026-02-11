'use server';

import webpush from 'web-push';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-guard';
import { withErrorLogging } from '@/lib/errors';

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
): Promise<{ success: boolean; sent: number; failed: number }> {
  ensureVapid();
  const supabase = await createClient();

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!subscriptions || subscriptions.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh || '', auth: sub.auth || '' },
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          tag: payload.tag || 'hazel',
          url: payload.url || '/',
          requireInteraction: payload.requireInteraction || false,
        }),
      ),
    ),
  );

  // 실패한 구독은 비활성화
  const failedEndpoints = subscriptions
    .filter((_, i) => results[i]?.status === 'rejected')
    .map((s) => s.endpoint);

  if (failedEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .in('endpoint', failedEndpoints);
  }

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return { success: true, sent, failed: failedEndpoints.length };
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
    return { success: true, sent: 0, failed: 0 };
  }

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh || '', auth: sub.auth || '' },
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          tag: payload.tag || 'hazel',
          url: payload.url || '/',
          requireInteraction: payload.requireInteraction || false,
        }),
      ),
    ),
  );

  const failedEndpoints = subscriptions
    .filter((_, i) => results[i]?.status === 'rejected')
    .map((s) => s.endpoint);

  if (failedEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .in('endpoint', failedEndpoints);
  }

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return { success: true, sent, failed: failedEndpoints.length };
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
  return { success: result.sent > 0, error: result.sent === 0 ? '활성 구독이 없습니다' : undefined };
}

export const sendTestNotification = withErrorLogging('sendTestNotification', _sendTestNotification);

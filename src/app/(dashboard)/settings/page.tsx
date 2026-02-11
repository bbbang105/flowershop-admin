'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Bell, BellOff, BellRing, Send } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { getCardCompanySettings, updateCardCompanySetting } from '@/lib/actions/settings';
import { subscribeToPush, unsubscribeFromPush, sendTestNotification } from '@/lib/actions/push';
import type { PushSubscriptionData } from '@/lib/actions/push';
import type { CardCompanySetting } from '@/types/database';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as Uint8Array<ArrayBuffer>;
}

export default function SettingsPage() {
  const [cardSettings, setCardSettings] = useState<CardCompanySetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 푸시 알림 상태
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);
  const [isPushLoading, setIsPushLoading] = useState(true);
  const [isPushToggling, setIsPushToggling] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  useEffect(() => {
    getCardCompanySettings()
      .then(data => setCardSettings(data))
      .catch(() => toast.error('설정을 불러오는데 실패했습니다'))
      .finally(() => setIsLoading(false));
  }, []);

  // 푸시 알림 지원 확인 + 기존 구독 확인
  const checkPushStatus = useCallback(async () => {
    setIsPushLoading(true);
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setPushSupported(false);
        return;
      }
      setPushSupported(true);
      setPushPermission(Notification.permission);

      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });
      const sub = await registration.pushManager.getSubscription();
      setPushSubscription(sub);
    } catch (err) {
      console.error('Push status check failed:', err);
    } finally {
      setIsPushLoading(false);
    }
  }, []);

  useEffect(() => {
    checkPushStatus();
  }, [checkPushStatus]);

  // 푸시 구독
  const handlePushSubscribe = async () => {
    setIsPushToggling(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        ),
      });

      setPushSubscription(sub);
      setPushPermission(Notification.permission);

      // 서버에 구독 정보 저장
      const subJson = sub.toJSON();
      const subscriptionData: PushSubscriptionData = {
        endpoint: subJson.endpoint!,
        keys: {
          p256dh: subJson.keys!.p256dh!,
          auth: subJson.keys!.auth!,
        },
      };

      const result = await subscribeToPush(subscriptionData);
      if (result.success) {
        toast.success('푸시 알림이 활성화되었습니다');
      } else {
        toast.error(result.error || '구독 저장에 실패했습니다');
        await sub.unsubscribe();
        setPushSubscription(null);
      }
    } catch (err) {
      console.error('Push subscribe failed:', err);
      if (Notification.permission === 'denied') {
        toast.error('브라우저에서 알림이 차단되어 있습니다. 브라우저 설정에서 허용해주세요.');
      } else {
        toast.error('푸시 알림 활성화에 실패했습니다');
      }
      setPushPermission(Notification.permission);
    } finally {
      setIsPushToggling(false);
    }
  };

  // 푸시 구독 해제
  const handlePushUnsubscribe = async () => {
    if (!pushSubscription) return;
    setIsPushToggling(true);
    try {
      const result = await unsubscribeFromPush(pushSubscription.endpoint);
      if (result.success) {
        await pushSubscription.unsubscribe();
        setPushSubscription(null);
        toast.success('푸시 알림이 비활성화되었습니다');
      } else {
        toast.error(result.error || '구독 해제에 실패했습니다');
      }
    } catch (err) {
      console.error('Push unsubscribe failed:', err);
      toast.error('푸시 알림 비활성화에 실패했습니다');
    } finally {
      setIsPushToggling(false);
    }
  };

  // 테스트 알림
  const handleTestNotification = async () => {
    setIsSendingTest(true);
    try {
      const result = await sendTestNotification();
      if (result.success) {
        toast.success('테스트 알림을 전송했습니다');
      } else {
        toast.error(result.error || '테스트 알림 전송에 실패했습니다');
      }
    } catch {
      toast.error('테스트 알림 전송에 실패했습니다');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Promise.all(
        cardSettings.map((setting) =>
          updateCardCompanySetting(setting.id, {
            fee_rate: setting.fee_rate,
            deposit_days: setting.deposit_days,
          })
        )
      );
      toast.success('설정이 저장되었습니다');
    } catch {
      toast.error('설정 저장에 실패했습니다');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">설정</h1>
        <p className="text-sm text-muted-foreground mt-1">카드사별 수수료와 입금까지 걸리는 기간을 설정해두면, 매출 등록 시 입금 예정 금액이 자동으로 계산돼요</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-medium text-foreground mb-1">카드사별 수수료율</h3>
          <p className="text-xs text-muted-foreground mb-4">수수료율: 카드사가 떼가는 비율 (예: 2.0% → 10만원 결제 시 2천원 수수료) / 입금 주기: 결제 후 입금까지 걸리는 영업일 수</p>
          {isLoading ? (
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_80px_80px] gap-3 pb-2 border-b border-border">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-3 w-14" />
              </div>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_80px] gap-3 items-center">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-9 w-full rounded-md" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              ))}
            </div>
          ) : cardSettings.length > 0 ? (
            <div className="space-y-3">
              {/* Header */}
              <div className="grid grid-cols-[1fr_80px_80px] gap-3 text-xs text-muted-foreground pb-2 border-b border-border">
                <span>카드사</span>
                <span>수수료율</span>
                <span>입금 주기</span>
              </div>
              {/* Rows */}
              {cardSettings.map((card) => (
                <div key={card.id} className="grid grid-cols-[1fr_80px_80px] gap-3 items-center">
                  <span className="text-sm font-medium text-foreground">{card.name}</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.1"
                      value={card.fee_rate}
                      onChange={(e) => setCardSettings(prev =>
                        prev.map(c => c.id === card.id ? { ...c, fee_rate: parseFloat(e.target.value) || 0 } : c)
                      )}
                      className="h-8 text-sm bg-background"
                      aria-label={`${card.name} 수수료율`}
                      inputMode="decimal"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={card.deposit_days}
                      onChange={(e) => setCardSettings(prev =>
                        prev.map(c => c.id === card.id ? { ...c, deposit_days: parseInt(e.target.value) || 0 } : c)
                      )}
                      className="h-8 text-sm bg-background"
                      aria-label={`${card.name} 입금 주기`}
                      inputMode="numeric"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">일</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">등록된 카드사 설정이 없습니다</p>
          )}
        </CardContent>
      </Card>

      {/* 푸시 알림 설정 */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-medium text-foreground mb-1">푸시 알림</h3>
          <p className="text-xs text-muted-foreground mb-4">
            예약 리마인더와 중요 알림을 푸시로 받을 수 있어요. 매일 오전 8시에 오늘의 예약 알림이 발송됩니다.
          </p>

          {isPushLoading ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-md" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ) : !pushSupported ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <BellOff className="w-5 h-5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">
                이 브라우저는 푸시 알림을 지원하지 않습니다. Chrome, Edge, Safari 등 최신 브라우저를 사용해주세요.
              </p>
            </div>
          ) : pushPermission === 'denied' ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10">
              <BellOff className="w-5 h-5 text-destructive shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">알림이 차단되어 있습니다</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  브라우저 설정에서 이 사이트의 알림을 허용해주세요.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {pushSubscription ? (
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-brand/10">
                      <BellRing className="w-5 h-5 text-brand" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted">
                      <Bell className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {pushSubscription ? '알림 활성화됨' : '알림 비활성화'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pushSubscription
                        ? '예약 리마인더와 알림을 받고 있습니다'
                        : '푸시 알림을 켜면 예약 리마인더를 받을 수 있어요'}
                    </p>
                  </div>
                </div>
                <Button
                  variant={pushSubscription ? 'outline' : 'default'}
                  size="sm"
                  onClick={pushSubscription ? handlePushUnsubscribe : handlePushSubscribe}
                  disabled={isPushToggling}
                >
                  {isPushToggling && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                  {pushSubscription ? '끄기' : '켜기'}
                </Button>
              </div>

              {pushSubscription && (
                <div className="pt-2 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleTestNotification}
                    disabled={isSendingTest}
                    className="text-muted-foreground"
                  >
                    {isSendingTest ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-1.5" />
                    )}
                    테스트 알림 보내기
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
        <p>매출 카테고리와 결제방식은 매출 관리 페이지의 설정 버튼에서 관리할 수 있습니다.</p>
        <p className="mt-1">사진첩 태그는 사진첩 페이지의 태그 관리에서 관리할 수 있습니다.</p>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving || isLoading}>
          {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isSaving ? '저장 중...' : '설정 저장'}
        </Button>
      </div>
    </div>
  );
}

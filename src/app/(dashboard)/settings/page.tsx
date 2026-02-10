'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { getCardCompanySettings, updateCardCompanySetting } from '@/lib/actions/settings';
import type { CardCompanySetting } from '@/types/database';

export default function SettingsPage() {
  const [cardSettings, setCardSettings] = useState<CardCompanySetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getCardCompanySettings()
      .then(data => setCardSettings(data))
      .catch(() => toast.error('설정을 불러오는데 실패했습니다'))
      .finally(() => setIsLoading(false));
  }, []);

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

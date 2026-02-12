'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, CreditCard, Wallet, Building2, Banknote } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface SalesSummaryProps {
  summary: {
    total: number;
    card: number;
    naverpay: number;
    transfer: number;
    cash: number;
  };
}

export function SalesSummary({ summary }: SalesSummaryProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      <Card className="col-span-2 sm:col-span-1">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">총 매출</p>
              <p className="text-sm sm:text-lg font-bold text-foreground">{formatCurrency(summary.total)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">카드</p>
              <p className="text-sm sm:text-lg font-bold text-foreground">{formatCurrency(summary.card)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">네이버페이</p>
              <p className="text-sm sm:text-lg font-bold text-foreground">{formatCurrency(summary.naverpay)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">계좌이체</p>
              <p className="text-sm sm:text-lg font-bold text-foreground">{formatCurrency(summary.transfer)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">현금</p>
              <p className="text-sm sm:text-lg font-bold text-foreground">{formatCurrency(summary.cash)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

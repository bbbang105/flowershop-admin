'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

function getMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: format(date, 'yyyy년 M월', { locale: ko }),
    });
  }
  return options;
}

export default function StatisticsPage() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const monthOptions = getMonthOptions();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">통계</h1>
          <p className="text-gray-500 mt-1">매출과 고객 통계를 확인하세요</p>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[150px] bg-white border-gray-200"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-lg font-semibold text-gray-900">상품 카테고리별 판매</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              Supabase 연동 후 차트가 표시됩니다
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-lg font-semibold text-gray-900">결제 방식별 매출</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              Supabase 연동 후 차트가 표시됩니다
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-lg font-semibold text-gray-900">예약 채널별 주문</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              Supabase 연동 후 차트가 표시됩니다
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-lg font-semibold text-gray-900">신규/재방문 고객 추이</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              Supabase 연동 후 차트가 표시됩니다
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

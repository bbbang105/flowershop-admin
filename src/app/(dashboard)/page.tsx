import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, CreditCard, Banknote, Clock, ArrowUpRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { format, startOfDay, startOfWeek, startOfMonth, endOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import Link from 'next/link';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(amount);
}

const paymentLabels: Record<string, string> = {
  cash: '현금', card: '카드', transfer: '계좌이체', naverpay: '네이버페이', kakaopay: '카카오페이',
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const todayEnd = endOfDay(now).toISOString();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const monthStart = startOfMonth(now).toISOString();

  // 오늘 매출
  const { data: todaySales } = await supabase
    .from('sales')
    .select('amount, payment_method')
    .gte('date', todayStart.split('T')[0])
    .lte('date', todayEnd.split('T')[0]);

  // 이번 주 매출
  const { data: weekSales } = await supabase
    .from('sales')
    .select('amount')
    .gte('date', weekStart.split('T')[0]);

  // 이번 달 매출
  const { data: monthSales } = await supabase
    .from('sales')
    .select('amount')
    .gte('date', monthStart.split('T')[0]);

  // 미입금 건수
  const { count: pendingCount } = await supabase
    .from('sales')
    .select('*', { count: 'exact', head: true })
    .eq('deposit_status', 'pending');

  // 최근 주문 5건
  const { data: recentSales } = await supabase
    .from('sales')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5);

  const todayTotal = todaySales?.reduce((sum, s) => sum + s.amount, 0) || 0;
  const todayCard = todaySales?.filter(s => s.payment_method === 'card').reduce((sum, s) => sum + s.amount, 0) || 0;
  const todayCash = todaySales?.filter(s => s.payment_method === 'cash').reduce((sum, s) => sum + s.amount, 0) || 0;
  const weekTotal = weekSales?.reduce((sum, s) => sum + s.amount, 0) || 0;
  const monthTotal = monthSales?.reduce((sum, s) => sum + s.amount, 0) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-gray-500 mt-1">오늘의 매출 현황을 확인하세요</p>
      </div>
      
      {/* 오늘 매출 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-rose-50 to-white">
          <CardContent className="p-4 lg:p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">오늘 총 매출</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(todayTotal)}
                </p>
              </div>
              <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-rose-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 lg:p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">카드 매출</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(todayCard)}
                </p>
              </div>
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 lg:p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">현금 매출</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(todayCash)}
                </p>
              </div>
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <Banknote className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 lg:p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">미입금</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">
                  {pendingCount || 0}건
                </p>
              </div>
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 기간별 매출 */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 lg:p-5">
            <p className="text-sm font-medium text-gray-500">이번 주 매출</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(weekTotal)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 lg:p-5">
            <p className="text-sm font-medium text-gray-500">이번 달 매출</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(monthTotal)}</p>
          </CardContent>
        </Card>
      </div>
      
      {/* 최근 주문 */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-900">최근 주문</CardTitle>
            <Link href="/sales" className="text-sm text-rose-500 hover:text-rose-600 flex items-center gap-1">
              더보기 <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {recentSales && recentSales.length > 0 ? (
            <div className="space-y-3">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-medium text-gray-600">
                      {format(new Date(sale.date), 'M/d')}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{sale.product_name}</p>
                      <p className="text-sm text-gray-500">
                        {paymentLabels[sale.payment_method]}
                        {sale.customer_name && ` · ${sale.customer_name}`}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold text-gray-900">{formatCurrency(sale.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p>등록된 매출이 없습니다</p>
              <Link href="/sales" className="text-rose-500 hover:text-rose-600 text-sm mt-2 inline-block">
                첫 매출 등록하기 →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

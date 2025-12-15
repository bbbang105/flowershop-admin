'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronUp, CreditCard, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { confirmDeposits } from '@/lib/actions/sales';
import type { Sale } from '@/types/database';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount);
}

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

export default function DepositsPage() {
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConfirming, setIsConfirming] = useState(false);
  const monthOptions = getMonthOptions();

  useEffect(() => {
    async function fetchSales() {
      setIsLoading(true);
      const supabase = createClient();
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      
      const { data } = await supabase
        .from('sales')
        .select('*')
        .eq('payment_method', 'card')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });
      
      setSales(data || []);
      setIsLoading(false);
    }
    fetchSales();
  }, [selectedMonth]);

  const pendingSales = useMemo(() => sales.filter(s => s.deposit_status === 'pending'), [sales]);
  const completedSales = useMemo(() => sales.filter(s => s.deposit_status === 'completed'), [sales]);
  
  const pendingTotal = useMemo(() => pendingSales.reduce((sum, s) => sum + (s.expected_deposit || s.amount), 0), [pendingSales]);
  const selectedTotal = useMemo(() => {
    return pendingSales.filter(s => selectedIds.has(s.id)).reduce((sum, s) => sum + (s.expected_deposit || s.amount), 0);
  }, [pendingSales, selectedIds]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(pendingSales.map(s => s.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleConfirm = async () => {
    if (selectedIds.size === 0) return;
    setIsConfirming(true);
    try {
      await confirmDeposits(Array.from(selectedIds));
      // Update local state
      setSales(sales.map(s => 
        selectedIds.has(s.id) 
          ? { ...s, deposit_status: 'completed' as const, deposited_at: new Date().toISOString() }
          : s
      ));
      toast.success(`${selectedIds.size}건의 입금이 확인되었습니다`);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to confirm deposits:', error);
      toast.error('입금 확인 처리에 실패했습니다');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">입금 대조</h1>
        <p className="text-gray-500 mt-1">카드 결제 입금 현황을 확인하세요</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">미입금</p>
                <p className="text-xl font-bold text-gray-900">{pendingSales.length}건</p>
                <p className="text-sm text-amber-600">{formatCurrency(pendingTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">입금완료</p>
                <p className="text-xl font-bold text-gray-900">{completedSales.length}건</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[140px] bg-white border-gray-200"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      
      {/* Pending Sales */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 bg-amber-50/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              미입금 ({pendingSales.length}건, {formatCurrency(pendingTotal)})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">로딩 중...</div>
          ) : pendingSales.length > 0 ? (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50">
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={selectedIds.size === pendingSales.length && pendingSales.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="font-semibold text-gray-700 w-[80px]">날짜</TableHead>
                      <TableHead className="font-semibold text-gray-700">상품</TableHead>
                      <TableHead className="font-semibold text-gray-700 text-right">금액</TableHead>
                      <TableHead className="font-semibold text-gray-700 hidden lg:table-cell">카드사</TableHead>
                      <TableHead className="font-semibold text-gray-700 hidden lg:table-cell">입금예정</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingSales.map((sale) => (
                      <TableRow key={sale.id} className="hover:bg-gray-50/50">
                        <TableCell>
                          <Checkbox 
                            checked={selectedIds.has(sale.id)}
                            onCheckedChange={(checked) => {
                              const newIds = new Set(selectedIds);
                              if (checked) newIds.add(sale.id);
                              else newIds.delete(sale.id);
                              setSelectedIds(newIds);
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-gray-600">{format(new Date(sale.date), 'M/d')}</TableCell>
                        <TableCell className="font-medium text-gray-900">{sale.product_name}</TableCell>
                        <TableCell className="text-right font-semibold text-gray-900">{formatCurrency(sale.expected_deposit || sale.amount)}</TableCell>
                        <TableCell className="hidden lg:table-cell text-gray-600">{sale.card_company || '-'}</TableCell>
                        <TableCell className="hidden lg:table-cell text-gray-600">
                          {sale.expected_deposit_date ? format(new Date(sale.expected_deposit_date), 'M/d') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile List */}
              <div className="md:hidden p-4 space-y-3">
                {pendingSales.map((sale) => (
                  <div key={sale.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Checkbox 
                      checked={selectedIds.has(sale.id)}
                      onCheckedChange={(checked) => {
                        const newIds = new Set(selectedIds);
                        if (checked) newIds.add(sale.id);
                        else newIds.delete(sale.id);
                        setSelectedIds(newIds);
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <span className="font-medium text-gray-900 truncate">{sale.product_name}</span>
                        <span className="font-semibold text-gray-900 ml-2">{formatCurrency(sale.expected_deposit || sale.amount)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                        <span>{format(new Date(sale.date), 'M/d')}</span>
                        {sale.card_company && <><span>·</span><span>{sale.card_company}</span></>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-gray-500">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-gray-400" />
                </div>
                <p>미입금 건이 없습니다</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Selection Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-4 bg-rose-50 rounded-xl border border-rose-100">
          <div>
            <span className="font-medium text-rose-700">선택: {selectedIds.size}건</span>
            <span className="text-rose-600 ml-2">({formatCurrency(selectedTotal)})</span>
          </div>
          <Button 
            onClick={handleConfirm} 
            disabled={isConfirming}
            className="bg-rose-500 hover:bg-rose-600"
          >
            {isConfirming && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isConfirming ? '처리 중...' : '입금 확인'}
          </Button>
        </div>
      )}
      
      {/* Completed Sales */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader 
          className="pb-3 cursor-pointer hover:bg-gray-50 transition-colors" 
          onClick={() => setShowCompleted(!showCompleted)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              입금 완료 ({completedSales.length}건)
            </CardTitle>
            {showCompleted ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </div>
        </CardHeader>
        {showCompleted && completedSales.length > 0 && (
          <CardContent className="p-0 border-t">
            <div className="hidden md:block">
              <Table>
                <TableBody>
                  {completedSales.map((sale) => (
                    <TableRow key={sale.id} className="bg-green-50/30">
                      <TableCell className="text-gray-600 w-[80px]">{format(new Date(sale.date), 'M/d')}</TableCell>
                      <TableCell className="font-medium text-gray-900">{sale.product_name}</TableCell>
                      <TableCell className="text-right font-semibold text-gray-900">{formatCurrency(sale.expected_deposit || sale.amount)}</TableCell>
                      <TableCell className="text-gray-500 hidden lg:table-cell">{sale.card_company || '-'}</TableCell>
                      <TableCell className="text-green-600 hidden lg:table-cell">
                        {sale.deposited_at ? format(new Date(sale.deposited_at), 'M/d 입금') : '입금완료'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="md:hidden p-4 space-y-2">
              {completedSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between p-3 bg-green-50/50 rounded-lg">
                  <div>
                    <span className="font-medium text-gray-900">{sale.product_name}</span>
                    <div className="text-sm text-gray-500">{format(new Date(sale.date), 'M/d')} · {sale.card_company}</div>
                  </div>
                  <span className="font-semibold text-gray-900">{formatCurrency(sale.expected_deposit || sale.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

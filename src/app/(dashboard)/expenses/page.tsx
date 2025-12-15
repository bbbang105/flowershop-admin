'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Wallet, Trash2, ChevronRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { createExpense, deleteExpense } from '@/lib/actions/expenses';
import type { Expense } from '@/types/database';

const categoryLabels: Record<string, string> = {
  flower_purchase: '꽃 사입', delivery: '배송비', advertising: '광고비',
  rent: '임대료', utilities: '공과금', supplies: '소모품', other: '기타',
};
const categoryColors: Record<string, string> = {
  flower_purchase: 'bg-pink-50 text-pink-700',
  delivery: 'bg-blue-50 text-blue-700',
  advertising: 'bg-purple-50 text-purple-700',
  rent: 'bg-orange-50 text-orange-700',
  utilities: 'bg-cyan-50 text-cyan-700',
  supplies: 'bg-gray-100 text-gray-700',
  other: 'bg-gray-100 text-gray-700',
};

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

export default function ExpensesPage() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [categoryFilter, setCategoryFilter] = useState('all');
  const monthOptions = getMonthOptions();

  useEffect(() => {
    async function fetchExpenses() {
      setIsLoading(true);
      const supabase = createClient();
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });
      
      setExpenses(data || []);
      setIsLoading(false);
    }
    fetchExpenses();
  }, [selectedMonth]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => categoryFilter === 'all' || e.category === categoryFilter);
  }, [expenses, categoryFilter]);

  const summary = useMemo(() => {
    const byCategory: Record<string, number> = {};
    let total = 0;
    filteredExpenses.forEach(e => {
      total += e.total_amount;
      byCategory[e.category] = (byCategory[e.category] || 0) + e.total_amount;
    });
    return { total, byCategory };
  }, [filteredExpenses]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      await createExpense(formData);
      setIsFormOpen(false);
      router.refresh();
      toast.success('지출이 등록되었습니다');
      // Refetch
      const supabase = createClient();
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });
      setExpenses(data || []);
    } catch (error) {
      console.error('Failed to create expense:', error);
      toast.error('지출 등록에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await deleteExpense(id);
      setExpenses(expenses.filter(e => e.id !== id));
      toast.success('지출이 삭제되었습니다');
    } catch (error) {
      console.error('Failed to delete expense:', error);
      toast.error('지출 삭제에 실패했습니다');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">지출 관리</h1>
          <p className="text-gray-500 mt-1">지출 내역을 등록하고 관리하세요</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="bg-rose-500 hover:bg-rose-600">
          <Plus className="h-4 w-4 mr-2" />
          지출 등록
        </Button>
      </div>

      {/* Summary */}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-50 to-white">
        <CardContent className="p-4 lg:p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <Wallet className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">월 총 지출</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.total)}</p>
            </div>
          </div>
          {Object.keys(summary.byCategory).length > 0 && (
            <div className="flex flex-wrap gap-2 pt-3 border-t border-orange-100">
              {Object.entries(summary.byCategory).map(([cat, amount]) => (
                <span key={cat} className="text-sm text-gray-600">
                  {categoryLabels[cat]}: <strong>{formatCurrency(amount)}</strong>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[140px] bg-white border-gray-200"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[130px] bg-white border-gray-200"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {Object.entries(categoryLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      
      {/* Desktop Table */}
      <Card className="border-0 shadow-sm overflow-hidden hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="font-semibold text-gray-700 w-[90px]">날짜</TableHead>
                <TableHead className="font-semibold text-gray-700">물품명</TableHead>
                <TableHead className="font-semibold text-gray-700 w-[100px]">카테고리</TableHead>
                <TableHead className="font-semibold text-gray-700 text-right hidden lg:table-cell">단가</TableHead>
                <TableHead className="font-semibold text-gray-700 text-right hidden lg:table-cell w-[60px]">수량</TableHead>
                <TableHead className="font-semibold text-gray-700 text-right">총액</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-gray-500">로딩 중...</TableCell></TableRow>
              ) : filteredExpenses.length > 0 ? filteredExpenses.map((e) => (
                <TableRow key={e.id} className="hover:bg-gray-50/50">
                  <TableCell className="text-gray-600">{format(new Date(e.date), 'M/d')}</TableCell>
                  <TableCell className="font-medium text-gray-900">{e.item_name}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs font-medium rounded-md ${categoryColors[e.category]}`}>
                      {categoryLabels[e.category]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-gray-600 hidden lg:table-cell">{formatCurrency(e.unit_price)}</TableCell>
                  <TableCell className="text-right text-gray-600 hidden lg:table-cell">{e.quantity}</TableCell>
                  <TableCell className="text-right font-semibold text-gray-900">{formatCurrency(e.total_amount)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => handleDelete(e.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <Wallet className="w-6 h-6 text-gray-400" />
                      </div>
                      <p>등록된 지출이 없습니다</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <Card className="border-0 shadow-sm p-8 text-center text-gray-500">로딩 중...</Card>
        ) : filteredExpenses.length > 0 ? filteredExpenses.map((e) => (
          <Card key={e.id} className="border-0 shadow-sm p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900">{e.item_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">{format(new Date(e.date), 'M/d')}</span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${categoryColors[e.category]}`}>
                    {categoryLabels[e.category]}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                  <span>단가: {formatCurrency(e.unit_price)}</span>
                  <span>수량: {e.quantity}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <span className="font-bold text-gray-900">{formatCurrency(e.total_amount)}</span>
              </div>
            </div>
          </Card>
        )) : (
          <Card className="border-0 shadow-sm p-8 text-center text-gray-500">
            등록된 지출이 없습니다
          </Card>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">지출 등록</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>날짜 *</Label>
                <Input type="date" name="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required className="bg-gray-50" />
              </div>
              <div className="space-y-2">
                <Label>카테고리 *</Label>
                <Select name="category" defaultValue="flower_purchase">
                  <SelectTrigger className="bg-gray-50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>물품명 *</Label>
              <Input name="item_name" placeholder="고터꽃사입" required className="bg-gray-50" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>단가 *</Label>
                <Input type="number" name="unit_price" placeholder="0" required className="bg-gray-50" />
              </div>
              <div className="space-y-2">
                <Label>수량</Label>
                <Input type="number" name="quantity" defaultValue="1" className="bg-gray-50" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>결제방식 *</Label>
              <Select name="payment_method" defaultValue="card">
                <SelectTrigger className="bg-gray-50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">현금</SelectItem>
                  <SelectItem value="card">카드</SelectItem>
                  <SelectItem value="transfer">계좌이체</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>비고</Label>
              <Input name="note" placeholder="메모" className="bg-gray-50" />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>취소</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-rose-500 hover:bg-rose-600">
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isSubmitting ? '저장 중...' : '저장'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AmountInput } from '@/components/ui/amount-input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Trash2, ChevronRight, Loader2, Wallet, Pencil, Settings, ShoppingCart, Truck, Megaphone, Home, Zap, Package } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { createExpense, updateExpense, deleteExpense } from '@/lib/actions/expenses';
import { ExpenseCategory, ExpensePaymentMethod, getExpenseCategories, getExpensePaymentMethods } from '@/lib/actions/expense-settings';
import { ExpenseSettingsModal } from '@/components/expenses/ExpenseSettingsModal';
import { cn, formatCurrency } from '@/lib/utils';
import type { Expense } from '@/types/database';
import { ExportButton } from '@/components/ui/export-button';
import type { ExportConfig } from '@/lib/export';

const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => 2024 + i);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

// 카테고리별 아이콘
const categoryIcons: Record<string, React.ReactNode> = {
  flower_purchase: <ShoppingCart className="h-4 w-4" />,
  delivery: <Truck className="h-4 w-4" />,
  advertising: <Megaphone className="h-4 w-4" />,
  rent: <Home className="h-4 w-4" />,
  utilities: <Zap className="h-4 w-4" />,
  supplies: <Package className="h-4 w-4" />,
  other: <Wallet className="h-4 w-4" />,
};

interface Props {
  initialExpenses: Expense[];
  currentYear: number;
  currentMonth: number;
  initialCategories: ExpenseCategory[];
  initialPayments: ExpensePaymentMethod[];
  initialSelectedExpense?: Expense | null;
}

export function ExpensesClient({
  initialExpenses,
  currentYear,
  currentMonth,
  initialCategories,
  initialPayments,
  initialSelectedExpense
}: Props) {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(initialSelectedExpense || null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noteValue, setNoteValue] = useState('');
  const [editNoteValue, setEditNoteValue] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [categories, setCategories] = useState<ExpenseCategory[]>(initialCategories);
  const [payments, setPayments] = useState<ExpensePaymentMethod[]>(initialPayments);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>(initialPayments[0]?.value || 'card');
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 카테고리/결제방식 라벨 및 색상 맵 생성
  const categoryLabels = useMemo(() =>
    Object.fromEntries(categories.map(c => [c.value, c.label])), [categories]);
  const categoryColors = useMemo(() =>
    Object.fromEntries(categories.map(c => [c.value, c.color])), [categories]);
  const paymentLabels = useMemo(() =>
    Object.fromEntries(payments.map(p => [p.value, p.label])), [payments]);
  const paymentColors = useMemo(() =>
    Object.fromEntries(payments.map(p => [p.value, p.color])), [payments]);

  // 설정 새로고침
  const refreshSettings = async () => {
    const [cats, pays] = await Promise.all([getExpenseCategories(), getExpensePaymentMethods()]);
    setCategories(cats);
    setPayments(pays);
  };

  const filteredExpenses = useMemo(() => {
    let result = initialExpenses;

    if (paymentFilter !== 'all') {
      result = result.filter(e => e.payment_method === paymentFilter);
    }

    if (categoryFilter !== 'all') {
      result = result.filter(e => e.category === categoryFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.item_name.toLowerCase().includes(q) ||
        (e.vendor?.toLowerCase().includes(q)) ||
        (e.note?.toLowerCase().includes(q))
      );
    }

    return result;
  }, [initialExpenses, paymentFilter, categoryFilter, searchQuery]);

  const summary = useMemo(() => {
    const byCategory: Record<string, number> = {};
    let total = 0;
    filteredExpenses.forEach(e => {
      total += e.total_amount;
      byCategory[e.category] = (byCategory[e.category] || 0) + e.total_amount;
    });
    return { total, byCategory };
  }, [filteredExpenses]);

  const getExportConfig = useCallback((): ExportConfig<Expense> => ({
    filename: `지출_${currentYear}-${String(currentMonth).padStart(2, '0')}`,
    title: `지출 내역 (${currentYear}년 ${currentMonth}월)`,
    columns: [
      { header: '날짜', accessor: (e) => String(e.date || '') },
      { header: '카테고리', accessor: (e) => categoryLabels[e.category] || e.category || '' },
      { header: '금액', accessor: (e) => Number(e.total_amount) || 0, format: 'currency' },
      { header: '결제방법', accessor: (e) => paymentLabels[e.payment_method] || e.payment_method || '' },
      { header: '수량', accessor: (e) => Number(e.quantity) || 0 },
      { header: '품목명', accessor: (e) => String(e.item_name || '') },
      { header: '거래처', accessor: (e) => String(e.vendor || '') },
      { header: '비고', accessor: (e) => String(e.note || '') },
    ],
    data: filteredExpenses,
  }), [filteredExpenses, currentYear, currentMonth, categoryLabels, paymentLabels]);

  const handleSelectExpense = (expense: Expense) => {
    setSelectedExpense(expense);
  };

  const handleYearChange = (year: string) => {
    router.push(`/expenses?year=${year}&month=${currentMonth}`);
  };

  const handleMonthChange = (month: string) => {
    router.push(`/expenses?year=${currentYear}&month=${month}`);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      await createExpense(formData);

      setIsFormOpen(false);
      router.refresh();
      toast.success('지출이 등록되었습니다');
    } catch (error) {
      console.error('Failed to create expense:', error);
      toast.error('지출 등록에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingExpense) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      await updateExpense(editingExpense.id, formData);

      setEditingExpense(null);
      setSelectedExpense(null);
      router.refresh();
      toast.success('지출이 수정되었습니다');
    } catch (error) {
      console.error('Failed to update expense:', error);
      toast.error('지출 수정에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setEditNoteValue(expense.note || '');
    setEditPaymentMethod(expense.payment_method);
    setSelectedExpense(null);
  };

  const handleDelete = (expense: Expense) => {
    setDeleteTarget(expense);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteExpense(deleteTarget.id);
      setDeleteTarget(null);
      setSelectedExpense(null);
      router.refresh();
      toast.success('지출이 삭제되었습니다');
    } catch (error) {
      console.error('Failed to delete expense:', error);
      toast.error('지출 삭제에 실패했습니다');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">지출 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">지출 내역을 등록하고 관리하세요</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton getExportConfig={getExportConfig} />
          <Button onClick={() => { setIsFormOpen(true); setNoteValue(''); setSelectedPaymentMethod(payments[0]?.value || 'card'); }}>
            <Plus className="w-4 h-4 mr-2" />
            지출 등록
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">총 지출</p>
                <p className="text-lg font-bold text-foreground truncate">{formatCurrency(summary.total)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {Object.entries(summary.byCategory).slice(0, 3).map(([cat, amount]) => (
          <Card key={cat}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${categoryColors[cat]}20` }}
                >
                  <span style={{ color: categoryColors[cat] }}>
                    {categoryIcons[cat] || <Wallet className="h-4 w-4" />}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{categoryLabels[cat]}</p>
                  <p className="text-lg font-bold text-foreground truncate">{formatCurrency(amount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={currentYear.toString()} onValueChange={handleYearChange}>
          <SelectTrigger className="w-[100px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEAR_OPTIONS.map(year => (
              <SelectItem key={year} value={year.toString()}>{year}년</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={currentMonth.toString()} onValueChange={handleMonthChange}>
          <SelectTrigger className="w-[80px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_OPTIONS.map(month => (
              <SelectItem key={month} value={month.toString()}>{month}월</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-auto min-w-[140px] bg-background">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-xs">카테고리</span>
              {categoryFilter === 'all' ? (
                <span>전체</span>
              ) : (
                <span
                  className="px-1.5 py-0.5 text-xs font-medium rounded"
                  style={{ backgroundColor: `${categoryColors[categoryFilter]}40`, color: categoryColors[categoryFilter] }}
                >
                  {categoryLabels[categoryFilter] || categoryFilter}
                </span>
              )}
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.value}>
                <span
                  className="px-1.5 py-0.5 text-xs font-medium rounded"
                  style={{ backgroundColor: `${cat.color}40`, color: cat.color }}
                >
                  {cat.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-auto min-w-[120px] bg-background">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-xs">결제</span>
              {paymentFilter === 'all' ? (
                <span>전체</span>
              ) : (
                <span
                  className="px-1.5 py-0.5 text-xs font-medium rounded"
                  style={{ backgroundColor: `${paymentColors[paymentFilter]}40`, color: paymentColors[paymentFilter] }}
                >
                  {paymentLabels[paymentFilter] || paymentFilter}
                </span>
              )}
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {payments.map(pm => (
              <SelectItem key={pm.id} value={pm.value}>
                <span
                  className="px-1.5 py-0.5 text-xs font-medium rounded"
                  style={{ backgroundColor: `${pm.color}40`, color: pm.color }}
                >
                  {pm.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={() => setIsSettingsOpen(true)}
          aria-label="지출 설정"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
        </Button>
        <div className="relative flex-1 min-w-[150px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background"
            aria-label="지출 검색"
          />
        </div>
      </div>

      {/* Desktop Table */}
      <Card className="overflow-hidden hidden md:block">
        <CardContent className="p-0">
          <Table>
            <caption className="sr-only">지출 내역 목록</caption>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[120px] pl-6">날짜</TableHead>
                <TableHead className="w-[140px]">카테고리</TableHead>
                <TableHead className="w-[120px]">금액</TableHead>
                <TableHead className="w-[100px]">결제</TableHead>
                <TableHead className="w-[100px] hidden lg:table-cell">수량</TableHead>
                <TableHead className="w-[200px] hidden lg:table-cell">물품명</TableHead>
                <TableHead className="hidden xl:table-cell">비고</TableHead>
                <TableHead className="w-[130px] text-right pr-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                    {(paymentFilter !== 'all' || categoryFilter !== 'all' || searchQuery) ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                          <Search className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p>선택한 필터에 맞는 지출이 없습니다</p>
                        <Button variant="outline" size="sm" onClick={() => { setPaymentFilter('all'); setCategoryFilter('all'); setSearchQuery(''); }}>
                          필터 초기화
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                          <Wallet className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p>등록된 지출이 없습니다</p>
                        <Button variant="outline" size="sm" onClick={() => { setIsFormOpen(true); setNoteValue(''); }}>
                          첫 지출 등록하기
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((expense) => (
                  <TableRow
                    key={expense.id}
                    className="cursor-pointer hover:bg-muted/50 active:bg-muted transition-colors"
                    onClick={() => handleSelectExpense(expense)}
                  >
                    <TableCell className="text-muted-foreground pl-6">{format(new Date(expense.date), 'M/d (E)', { locale: ko })}</TableCell>
                    <TableCell>
                      <span
                        className="px-2 py-1 text-xs font-medium rounded-md"
                        style={{
                          backgroundColor: categoryColors[expense.category] ? `${categoryColors[expense.category]}40` : '#f3f4f6',
                          color: categoryColors[expense.category] || '#374151'
                        }}
                      >
                        {categoryLabels[expense.category] || expense.category}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">{formatCurrency(expense.total_amount)}</TableCell>
                    <TableCell>
                      <span
                        className="px-2 py-1 text-xs font-medium rounded-md"
                        style={{
                          backgroundColor: paymentColors[expense.payment_method] ? `${paymentColors[expense.payment_method]}40` : '#f3f4f6',
                          color: paymentColors[expense.payment_method] || '#374151'
                        }}
                      >
                        {paymentLabels[expense.payment_method] || expense.payment_method}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell">{expense.quantity}개</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground truncate max-w-[200px]">{expense.item_name}</TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground text-sm truncate" title={expense.note || ''}>
                      {expense.note || '-'}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(expense);
                          }}
                          aria-label="수정"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(expense);
                          }}
                          aria-label="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {filteredExpenses.length === 0 ? (
          <Card className="p-8 text-center">
            {(paymentFilter !== 'all' || categoryFilter !== 'all' || searchQuery) ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Search className="w-8 h-8 text-muted-foreground opacity-40" />
                <p className="text-sm">선택한 필터에 맞는 지출이 없습니다</p>
                <Button variant="outline" size="sm" onClick={() => { setPaymentFilter('all'); setCategoryFilter('all'); setSearchQuery(''); }}>
                  필터 초기화
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-muted-foreground" />
                </div>
                <p>등록된 지출이 없습니다</p>
              </div>
            )}
          </Card>
        ) : (
          filteredExpenses.map((expense) => (
            <Card
              key={expense.id}
              className="p-4 cursor-pointer hover:bg-muted/30 active:bg-muted active:scale-[0.99] transition-colors touch-manipulation"
              onClick={() => handleSelectExpense(expense)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-foreground truncate max-w-[180px]">{expense.item_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="text-muted-foreground flex-shrink-0">{format(new Date(expense.date), 'M/d')}</span>
                    <span
                      className="px-2 py-0.5 text-xs font-medium rounded flex-shrink-0"
                      style={{
                        backgroundColor: categoryColors[expense.category] ? `${categoryColors[expense.category]}40` : '#f3f4f6',
                        color: categoryColors[expense.category] || '#374151'
                      }}
                    >
                      {categoryLabels[expense.category] || expense.category}
                    </span>
                    <span
                      className="px-2 py-0.5 text-xs font-medium rounded flex-shrink-0"
                      style={{
                        backgroundColor: paymentColors[expense.payment_method] ? `${paymentColors[expense.payment_method]}40` : '#f3f4f6',
                        color: paymentColors[expense.payment_method] || '#374151'
                      }}
                    >
                      {paymentLabels[expense.payment_method] || expense.payment_method}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-bold text-foreground whitespace-nowrap">{formatCurrency(expense.total_amount)}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">지출 등록</DialogTitle>
            <p className="text-sm text-muted-foreground">꽃 구매, 배달비 등 지출 내역을 입력해주세요. 총액은 단가 x 수량으로 자동 계산돼요.</p>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="space-y-5 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>날짜 *</Label>
                <Input type="date" name="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>카테고리 *</Label>
                <Select name="category" defaultValue={categories[0]?.value || 'flower_purchase'}>
                  <SelectTrigger className="bg-muted">
                    <SelectValue placeholder="카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>물품명 *</Label>
              <Input name="item_name" placeholder="예: 장미 50송이, 배달비" required className="bg-muted" />
              <p className="text-[11px] text-muted-foreground">어디서 뭘 샀는지 적어주세요</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>단가 *</Label>
                <AmountInput name="unit_price" placeholder="0" required className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>수량</Label>
                <Input type="number" name="quantity" defaultValue="1" min="1" className="bg-muted" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>결제방식 *</Label>
              <input type="hidden" name="payment_method" value={selectedPaymentMethod} />
              <div className="flex flex-wrap gap-2">
                {payments.map(pm => (
                  <button
                    key={pm.id}
                    type="button"
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                      selectedPaymentMethod === pm.value
                        ? "ring-2 ring-offset-1 ring-brand/50"
                        : "border-border text-muted-foreground hover:border-foreground/30"
                    )}
                    style={selectedPaymentMethod === pm.value ? { backgroundColor: `${pm.color}20`, color: pm.color, borderColor: pm.color } : {}}
                    onClick={() => setSelectedPaymentMethod(pm.value)}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>거래처</Label>
              <Input name="vendor" placeholder="예: 고속터미널 꽃시장" className="bg-muted" />
              <p className="text-[11px] text-muted-foreground">어디서 구매했는지 적어두면 나중에 찾기 편해요</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>비고</Label>
                <span className={cn("text-xs", noteValue.length > 100 ? "text-destructive" : "text-muted-foreground")}>
                  {noteValue.length}/100
                </span>
              </div>
              <Textarea
                name="note"
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value.slice(0, 100))}
                placeholder="메모"
                className="bg-muted min-h-[60px] resize-none"
                maxLength={100}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>취소</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isSubmitting ? '저장 중...' : '저장'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Expense Detail Dialog */}
      <Dialog open={!!selectedExpense} onOpenChange={(open) => !open && setSelectedExpense(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">지출 상세</DialogTitle>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">날짜</p>
                  <p className="font-medium">{format(new Date(selectedExpense.date), 'yyyy년 M월 d일', { locale: ko })}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">총액</p>
                  <p className="font-bold text-lg text-brand">{formatCurrency(selectedExpense.total_amount)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">물품명</p>
                  <p className="font-medium">{selectedExpense.item_name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">카테고리</p>
                  <span
                    className="inline-block px-2 py-1 text-xs font-medium rounded-md"
                    style={{
                      backgroundColor: categoryColors[selectedExpense.category] ? `${categoryColors[selectedExpense.category]}40` : '#f3f4f6',
                      color: categoryColors[selectedExpense.category] || '#374151'
                    }}
                  >
                    {categoryLabels[selectedExpense.category] || selectedExpense.category}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">결제방식</p>
                  <span
                    className="inline-block px-2 py-1 text-xs font-medium rounded-md"
                    style={{
                      backgroundColor: paymentColors[selectedExpense.payment_method] ? `${paymentColors[selectedExpense.payment_method]}40` : '#f3f4f6',
                      color: paymentColors[selectedExpense.payment_method] || '#374151'
                    }}
                  >
                    {paymentLabels[selectedExpense.payment_method] || selectedExpense.payment_method}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">단가 x 수량 = 총액</p>
                  <p className="font-medium">{formatCurrency(selectedExpense.unit_price)} x {selectedExpense.quantity} = {formatCurrency(selectedExpense.total_amount)}</p>
                </div>
              </div>

              {selectedExpense.vendor && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">거래처</p>
                  <p className="font-medium">{selectedExpense.vendor}</p>
                </div>
              )}

              {selectedExpense.note && (
                <div className="space-y-1 pt-2 border-t">
                  <p className="text-sm text-muted-foreground">비고</p>
                  <p className="text-foreground">{selectedExpense.note}</p>
                </div>
              )}

              <div className="flex justify-between pt-4 border-t">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleEdit(selectedExpense)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    수정
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(selectedExpense)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    삭제
                  </Button>
                </div>
                <Button variant="outline" onClick={() => setSelectedExpense(null)}>
                  닫기
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingExpense} onOpenChange={(open) => !open && setEditingExpense(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">지출 수정</DialogTitle>
          </DialogHeader>
          {editingExpense && (
            <form onSubmit={(e) => { e.preventDefault(); handleUpdate(e); }} className="space-y-5 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>날짜 *</Label>
                  <Input type="date" name="date" defaultValue={editingExpense.date} required className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>카테고리 *</Label>
                  <Select name="category" defaultValue={editingExpense.category} key={`cat-${editingExpense.id}`}>
                    <SelectTrigger className="bg-muted">
                      <SelectValue placeholder="카테고리 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>물품명 *</Label>
                <Input name="item_name" defaultValue={editingExpense.item_name} required className="bg-muted" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>단가 *</Label>
                  <AmountInput name="unit_price" value={editingExpense.unit_price} required className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>수량</Label>
                  <Input type="number" name="quantity" defaultValue={editingExpense.quantity} min="1" className="bg-muted" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>결제방식 *</Label>
                <input type="hidden" name="payment_method" value={editPaymentMethod} />
                <div className="flex flex-wrap gap-2">
                  {payments.map(pm => (
                    <button
                      key={pm.id}
                      type="button"
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                        editPaymentMethod === pm.value
                          ? "ring-2 ring-offset-1 ring-brand/50"
                          : "border-border text-muted-foreground hover:border-foreground/30"
                      )}
                      style={editPaymentMethod === pm.value ? { backgroundColor: `${pm.color}20`, color: pm.color, borderColor: pm.color } : {}}
                      onClick={() => setEditPaymentMethod(pm.value)}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>거래처</Label>
                <Input name="vendor" defaultValue={editingExpense.vendor || ''} placeholder="거래처명" className="bg-muted" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>비고</Label>
                  <span className={cn("text-xs", editNoteValue.length > 100 ? "text-destructive" : "text-muted-foreground")}>
                    {editNoteValue.length}/100
                  </span>
                </div>
                <Textarea
                  name="note"
                  value={editNoteValue}
                  onChange={(e) => setEditNoteValue(e.target.value.slice(0, 100))}
                  placeholder="메모"
                  className="bg-muted min-h-[60px] resize-none"
                  maxLength={100}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setEditingExpense(null)}>취소</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isSubmitting ? '저장 중...' : '저장'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>지출 삭제</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground text-sm">
              이 지출 기록을 삭제하시겠습니까?
            </p>
            {deleteTarget && (
              <p className="text-muted-foreground text-xs mt-2">
                {format(new Date(deleteTarget.date), 'M월 d일', { locale: ko })} · {deleteTarget.item_name} · {formatCurrency(deleteTarget.total_amount)}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isDeleting ? '삭제 중...' : '삭제'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expense Settings Modal */}
      <ExpenseSettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        categories={categories}
        onRefresh={refreshSettings}
      />
    </div>
  );
}

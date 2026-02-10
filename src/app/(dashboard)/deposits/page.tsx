'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  CreditCard,
  CheckCircle2,
  Clock,
  Loader2,
  MoreHorizontal,
  Undo2,
  ArrowUpDown,
  Filter,
  X,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import Link from 'next/link';
import { getDeposits, confirmMultipleDeposits, revertDeposit } from '@/lib/actions/deposits';
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

type SortField = 'date' | 'amount' | 'card_company';
type SortDir = 'asc' | 'desc';

export default function DepositsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConfirming, setIsConfirming] = useState(false);
  const [revertDialog, setRevertDialog] = useState<{ open: boolean; sale: Sale | null }>({ open: false, sale: null });
  const [isReverting, setIsReverting] = useState(false);
  const [cardFilter, setCardFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const monthOptions = getMonthOptions();

  // Fetch data via server action
  useEffect(() => {
    async function fetchSales() {
      setIsLoading(true);
      setSelectedIds(new Set());
      try {
        const data = await getDeposits({ month: selectedMonth });
        setSales(data);
      } catch {
        toast.error('입금 데이터를 불러오는데 실패했습니다');
        setSales([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSales();
  }, [selectedMonth]);

  // Derived data
  const pendingSales = useMemo(() => sales.filter((s) => s.deposit_status === 'pending'), [sales]);
  const completedSales = useMemo(() => sales.filter((s) => s.deposit_status === 'completed'), [sales]);

  // Card companies for filter
  const cardCompanies = useMemo(() => {
    const companies = new Set<string>();
    sales.forEach((s) => {
      if (s.card_company) companies.add(s.card_company);
    });
    return Array.from(companies).sort();
  }, [sales]);

  // Filter + Sort
  const filterAndSort = useCallback(
    (items: Sale[]) => {
      let filtered = items;
      if (cardFilter !== 'all') {
        filtered = filtered.filter((s) => s.card_company === cardFilter);
      }
      return filtered.sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        if (sortField === 'date') return (a.date.localeCompare(b.date)) * dir;
        if (sortField === 'amount') return ((a.expected_deposit || a.amount) - (b.expected_deposit || b.amount)) * dir;
        if (sortField === 'card_company') return ((a.card_company || '').localeCompare(b.card_company || '')) * dir;
        return 0;
      });
    },
    [cardFilter, sortField, sortDir]
  );

  const filteredPending = useMemo(() => filterAndSort(pendingSales), [filterAndSort, pendingSales]);
  const filteredCompleted = useMemo(() => filterAndSort(completedSales), [filterAndSort, completedSales]);

  // Summary
  const pendingTotal = useMemo(() => pendingSales.reduce((sum, s) => sum + (s.expected_deposit || s.amount), 0), [pendingSales]);
  const completedTotal = useMemo(() => completedSales.reduce((sum, s) => sum + (s.expected_deposit || s.amount), 0), [completedSales]);
  const totalCardSales = pendingTotal + completedTotal;
  const completionRate = totalCardSales > 0 ? Math.round((completedTotal / totalCardSales) * 100) : 0;

  const selectedTotal = useMemo(() => {
    return filteredPending
      .filter((s) => selectedIds.has(s.id))
      .reduce((sum, s) => sum + (s.expected_deposit || s.amount), 0);
  }, [filteredPending, selectedIds]);

  // Handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredPending.map((s) => s.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id: string) => {
    const newIds = new Set(selectedIds);
    if (newIds.has(id)) newIds.delete(id);
    else newIds.add(id);
    setSelectedIds(newIds);
  };

  const handleConfirm = async () => {
    if (selectedIds.size === 0) return;
    setIsConfirming(true);
    try {
      await confirmMultipleDeposits(Array.from(selectedIds));
      setSales((prev) =>
        prev.map((s) =>
          selectedIds.has(s.id)
            ? { ...s, deposit_status: 'completed' as const, deposited_at: new Date().toISOString() }
            : s
        )
      );
      toast.success(`${selectedIds.size}건의 입금이 확인되었습니다`);
      setSelectedIds(new Set());
    } catch {
      toast.error('입금 확인 처리에 실패했습니다');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleRevert = async () => {
    if (!revertDialog.sale) return;
    setIsReverting(true);
    try {
      await revertDeposit(revertDialog.sale.id);
      setSales((prev) =>
        prev.map((s) =>
          s.id === revertDialog.sale!.id
            ? { ...s, deposit_status: 'pending' as const, deposited_at: undefined }
            : s
        )
      );
      toast.success('입금 확인이 취소되었습니다');
      setRevertDialog({ open: false, sale: null });
    } catch {
      toast.error('입금 취소에 실패했습니다');
    } finally {
      setIsReverting(false);
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      aria-label={`${children} 정렬`}
    >
      {children}
      <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-foreground' : 'text-muted-foreground/50'}`} aria-hidden="true" />
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">입금 대조</h1>
          <p className="text-sm text-muted-foreground mt-1 hidden sm:block">카드로 결제받은 금액이 통장에 들어왔는지 확인하는 곳이에요</p>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[130px] sm:w-[150px] bg-background shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs text-muted-foreground">카드 매출 합계</p>
            <p className="text-lg font-bold text-foreground mt-1 tabular-nums">{formatCurrency(totalCardSales)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">총 {sales.length}건</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">미입금</p>
              <Clock className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <p className="text-lg font-bold text-foreground mt-1 tabular-nums">{formatCurrency(pendingTotal)}</p>
            <p className="text-xs text-amber-600 mt-0.5">{pendingSales.length}건 대기</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">입금완료</p>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <p className="text-lg font-bold text-foreground mt-1 tabular-nums">{formatCurrency(completedTotal)}</p>
            <p className="text-xs text-emerald-600 mt-0.5">{completedSales.length}건 완료</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs text-muted-foreground">입금률</p>
            <p className="text-lg font-bold text-foreground mt-1 tabular-nums">{completionRate}%</p>
            <Progress value={completionRate} className="h-1.5 mt-2" />
            <p className="text-[10px] text-muted-foreground mt-1">입금완료 / 전체 카드매출</p>
          </CardContent>
        </Card>
      </div>

      {/* Selection Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-brand-muted rounded-lg border border-brand/20 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="rounded-md">
              {selectedIds.size}건 선택
            </Badge>
            <span className="text-sm font-medium text-brand tabular-nums">{formatCurrency(selectedTotal)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              선택 해제
            </Button>
            <Button size="sm" onClick={handleConfirm} disabled={isConfirming}>
              {isConfirming && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              입금 확인
            </Button>
          </div>
        </div>
      )}

      {/* Tabs + Filter */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="pending" className="gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                미입금
                {pendingSales.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 rounded">
                    {pendingSales.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="completed" className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                입금완료
                {completedSales.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 rounded">
                    {completedSales.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Card Company Filter */}
          {cardCompanies.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={cardFilter} onValueChange={setCardFilter}>
                <SelectTrigger className="w-[130px] h-8 text-xs bg-background" aria-label="카드사 필터">
                  <SelectValue placeholder="카드사" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 카드사</SelectItem>
                  {cardCompanies.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cardFilter !== 'all' && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCardFilter('all')} aria-label="필터 초기화">
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {/* Desktop skeleton */}
              <div className="hidden md:block">
                <div className="grid grid-cols-[50px_90px_1fr_1fr_100px_110px_110px_90px] gap-4 px-4 py-3 border-b bg-muted/40">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </div>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-[50px_90px_1fr_1fr_100px_110px_110px_90px] gap-4 px-4 py-3.5 border-b last:border-0">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-4 w-20 ml-auto" />
                    <Skeleton className="h-4 w-20 ml-auto" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                ))}
              </div>
              {/* Mobile skeleton */}
              <div className="md:hidden divide-y divide-border">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 p-4">
                    <Skeleton className="h-4 w-4 rounded mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <div className="flex gap-2">
                        <Skeleton className="h-3 w-10" />
                        <Skeleton className="h-3 w-14 rounded-full" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Pending Tab */}
            {activeTab === 'pending' && (
              <Card className="overflow-hidden animate-in fade-in duration-200">
                <CardContent className="p-0">
                  {filteredPending.length > 0 ? (
                    <>
                      {/* Desktop Table */}
                      <div className="hidden md:block">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                              <TableHead className="w-12 pl-4">
                                <Checkbox
                                  checked={
                                    selectedIds.size === filteredPending.length && filteredPending.length > 0
                                  }
                                  onCheckedChange={handleSelectAll}
                                  aria-label="전체 선택"
                                />
                              </TableHead>
                              <TableHead className="w-[90px]">
                                <SortButton field="date">날짜</SortButton>
                              </TableHead>
                              <TableHead>상품</TableHead>
                              <TableHead>고객</TableHead>
                              <TableHead className="w-[100px]">
                                <SortButton field="card_company">카드사</SortButton>
                              </TableHead>
                              <TableHead className="text-right w-[110px]">
                                <SortButton field="amount">결제금액</SortButton>
                              </TableHead>
                              <TableHead className="text-right w-[110px]" title="결제금액에서 카드 수수료를 뺀 금액">예상입금</TableHead>
                              <TableHead className="w-[90px]" title="영업일 기준 입금 예정일">입금예정</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredPending.map((sale) => {
                              const depositAmount = sale.expected_deposit || sale.amount;
                              const fee = sale.amount - depositAmount;
                              return (
                                <TableRow
                                  key={sale.id}
                                  className={`hover:bg-muted/50 active:bg-muted transition-colors ${selectedIds.has(sale.id) ? 'bg-brand-muted/30' : ''}`}
                                >
                                  <TableCell className="pl-4">
                                    <Checkbox
                                      checked={selectedIds.has(sale.id)}
                                      onCheckedChange={() => toggleSelect(sale.id)}
                                      aria-label={`${sale.product_name} 선택`}
                                    />
                                  </TableCell>
                                  <TableCell className="text-muted-foreground tabular-nums">
                                    {format(new Date(sale.date), 'M/d')}
                                  </TableCell>
                                  <TableCell className="font-medium text-foreground max-w-[200px]">
                                    <div className="flex items-center gap-1.5">
                                      <span className="truncate">{sale.product_name}</span>
                                      <Link
                                        href={`/sales?year=${new Date(sale.date).getFullYear()}&month=${new Date(sale.date).getMonth() + 1}&saleId=${sale.id}`}
                                        className="text-brand hover:text-brand/80 shrink-0 transition-colors"
                                        title="매출 상세 보기"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                      </Link>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground text-sm">
                                    {sale.customer_name || '-'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-[11px] font-normal">
                                      {sale.card_company || '-'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums text-muted-foreground">
                                    {formatCurrency(sale.amount)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div>
                                      <span className="font-semibold text-foreground tabular-nums">
                                        {formatCurrency(depositAmount)}
                                      </span>
                                      {fee > 0 && (
                                        <p className="text-[10px] text-muted-foreground">
                                          수수료 {formatCurrency(fee)}
                                        </p>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground text-sm tabular-nums">
                                    {sale.expected_deposit_date
                                      ? format(new Date(sale.expected_deposit_date), 'M/d')
                                      : '-'}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Mobile List */}
                      <div className="md:hidden divide-y divide-border">
                        {filteredPending.map((sale) => {
                          const depositAmount = sale.expected_deposit || sale.amount;
                          return (
                            <div
                              key={sale.id}
                              className={`flex items-start gap-3 p-4 transition-colors touch-manipulation ${selectedIds.has(sale.id) ? 'bg-brand-muted/30' : ''}`}
                            >
                              <Checkbox
                                checked={selectedIds.has(sale.id)}
                                onCheckedChange={() => toggleSelect(sale.id)}
                                className="mt-0.5"
                                aria-label={`${sale.product_name} 선택`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="font-medium text-foreground text-sm truncate">
                                      {sale.product_name}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                      <span className="text-xs text-muted-foreground tabular-nums">
                                        {format(new Date(sale.date), 'M/d')}
                                      </span>
                                      {sale.card_company && (
                                        <Badge variant="outline" className="text-[10px] font-normal h-4 px-1.5">
                                          {sale.card_company}
                                        </Badge>
                                      )}
                                      {sale.customer_name && (
                                        <span className="text-xs text-muted-foreground">{sale.customer_name}</span>
                                      )}
                                      {sale.expected_deposit_date && (
                                        <span className="text-xs text-amber-600 tabular-nums">
                                          {format(new Date(sale.expected_deposit_date), 'M/d')} 예정
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <span className="font-semibold text-foreground tabular-nums text-sm shrink-0">
                                    {formatCurrency(depositAmount)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">미입금 건이 없습니다</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {cardFilter !== 'all' ? '선택한 카드사의 미입금 건이 없습니다' : '모든 카드 결제 금액이 통장에 입금되었어요'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Completed Tab */}
            {activeTab === 'completed' && (
              <Card className="overflow-hidden animate-in fade-in duration-200">
                <CardContent className="p-0">
                  {filteredCompleted.length > 0 ? (
                    <>
                      {/* Desktop Table */}
                      <div className="hidden md:block">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                              <TableHead className="w-[90px] pl-4">
                                <SortButton field="date">날짜</SortButton>
                              </TableHead>
                              <TableHead>상품</TableHead>
                              <TableHead>고객</TableHead>
                              <TableHead className="w-[100px]">
                                <SortButton field="card_company">카드사</SortButton>
                              </TableHead>
                              <TableHead className="text-right w-[110px]">
                                <SortButton field="amount">입금액</SortButton>
                              </TableHead>
                              <TableHead className="w-[100px]">입금일</TableHead>
                              <TableHead className="w-10 pr-4" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredCompleted.map((sale) => (
                              <TableRow key={sale.id} className="hover:bg-muted/50 transition-colors">
                                <TableCell className="text-muted-foreground tabular-nums pl-4">
                                  {format(new Date(sale.date), 'M/d')}
                                </TableCell>
                                <TableCell className="font-medium text-foreground max-w-[200px] truncate">
                                  {sale.product_name}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {sale.customer_name || '-'}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-[11px] font-normal">
                                    {sale.card_company || '-'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-semibold text-foreground tabular-nums">
                                  {formatCurrency(sale.expected_deposit || sale.amount)}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm tabular-nums">
                                  {sale.deposited_at
                                    ? format(new Date(sale.deposited_at), 'M/d')
                                    : '-'}
                                </TableCell>
                                <TableCell className="pr-4">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="더보기">
                                        <MoreHorizontal className="h-3.5 w-3.5" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() => setRevertDialog({ open: true, sale })}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Undo2 className="h-3.5 w-3.5 mr-2" />
                                        입금 취소
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Mobile List */}
                      <div className="md:hidden divide-y divide-border">
                        {filteredCompleted.map((sale) => (
                          <div key={sale.id} className="flex items-start justify-between gap-3 p-4">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-foreground text-sm truncate">
                                {sale.product_name}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(sale.date), 'M/d')}
                                </span>
                                {sale.card_company && (
                                  <Badge variant="outline" className="text-[10px] font-normal h-4 px-1.5">
                                    {sale.card_company}
                                  </Badge>
                                )}
                                {sale.deposited_at && (
                                  <span className="text-xs text-emerald-600">
                                    {format(new Date(sale.deposited_at), 'M/d')} 입금
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-semibold text-foreground tabular-nums text-sm">
                                {formatCurrency(sale.expected_deposit || sale.amount)}
                              </span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => setRevertDialog({ open: true, sale })}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Undo2 className="h-3.5 w-3.5 mr-2" />
                                    입금 취소
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">입금 완료 건이 없습니다</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {cardFilter !== 'all' ? '선택한 카드사의 입금 완료 건이 없습니다' : '아직 입금 확인된 건이 없습니다'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Revert Confirmation Dialog */}
      <Dialog open={revertDialog.open} onOpenChange={(open) => setRevertDialog({ open, sale: open ? revertDialog.sale : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>입금 확인 취소</DialogTitle>
            <DialogDescription>
              이 입금 확인을 취소하시겠습니까? 해당 건이 미입금 상태로 돌아갑니다.
            </DialogDescription>
          </DialogHeader>
          {revertDialog.sale && (
            <div className="p-3 bg-muted rounded-lg space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">상품</span>
                <span className="font-medium text-foreground">{revertDialog.sale.product_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">금액</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(revertDialog.sale.expected_deposit || revertDialog.sale.amount)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">카드사</span>
                <span className="text-foreground">{revertDialog.sale.card_company || '-'}</span>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setRevertDialog({ open: false, sale: null })} disabled={isReverting}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleRevert} disabled={isReverting}>
              {isReverting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              입금 취소 확인
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

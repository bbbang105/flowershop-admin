'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AmountInput } from '@/components/ui/amount-input';
import { Plus, Search, Trash2, ImageIcon, ChevronRight, CreditCard, Banknote, TrendingUp, Loader2, Wallet, Building2, Pencil, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { createSale, updateSale, deleteSale } from '@/lib/actions/sales';
import { getPhotoCardBySaleId } from '@/lib/actions/photo-cards';
import { SalePhotoModal } from '@/components/sales/SalePhotoModal';
import { SalesSettingsModal } from '@/components/sales/SalesSettingsModal';
import { CustomerAutocomplete } from '@/components/sales/CustomerAutocomplete';
import { Textarea } from '@/components/ui/textarea';
import { cn, formatPhoneNumber } from '@/lib/utils';
import type { PhotoCard, Sale, CardCompanySetting } from '@/types/database';
import { calculateSalesSummary } from '@/lib/utils';
import { SaleCategory, PaymentMethod, getSaleCategories, getPaymentMethods } from '@/lib/actions/sale-settings';
import { getCardCompanySettings } from '@/lib/actions/settings';

const channelLabels: Record<string, string> = {
  phone: '전화', kakaotalk: '카카오톡', naver_booking: '네이버예약', road: '로드', other: '기타',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount);
}

// Year options: 2024 ~ 2030
const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => 2024 + i);
// Month options: 1 ~ 12
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

interface Props {
  initialSales: Sale[];
  currentYear: number;
  currentMonth: number;
  initialCategories: SaleCategory[];
  initialPayments: PaymentMethod[];
  initialCardCompanies: CardCompanySetting[];
  initialSelectedSale?: Sale | null;
}

export function SalesClient({ initialSales, currentYear, currentMonth, initialCategories, initialPayments, initialCardCompanies, initialSelectedSale }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(initialSelectedSale || null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoModalSale, setPhotoModalSale] = useState<Sale | null>(null);
  const [showPhotoPrompt, setShowPhotoPrompt] = useState<Sale | null>(null);
  const [selectedSalePhotos, setSelectedSalePhotos] = useState<PhotoCard | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const [editNoteValue, setEditNoteValue] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [categories, setCategories] = useState<SaleCategory[]>(initialCategories);
  const [payments, setPayments] = useState<PaymentMethod[]>(initialPayments);
  const [cardCompanies, setCardCompanies] = useState<CardCompanySetting[]>(initialCardCompanies);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>(initialPayments[0]?.value || 'card');
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>('');

  // 고객 자동완성 상태
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerId, setEditCustomerId] = useState<string | null>(null);
  const [editCustomerPhone, setEditCustomerPhone] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 카테고리/결제방식 라벨 및 색상 맵 생성 (value -> label/color)
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
    const [cats, pays, cards] = await Promise.all([getSaleCategories(), getPaymentMethods(), getCardCompanySettings()]);
    setCategories(cats);
    setPayments(pays);
    setCardCompanies(cards);
  };

  // URL 파라미터로 등록 모달 자동 오픈 (고객 페이지에서 연결)
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create') {
      const paramCustomerName = searchParams.get('customer_name');
      const paramCustomerPhone = searchParams.get('customer_phone');
      const paramCustomerId = searchParams.get('customer_id');

      if (paramCustomerName) setCustomerName(paramCustomerName);
      if (paramCustomerPhone) setCustomerPhone(paramCustomerPhone);
      if (paramCustomerId) setCustomerId(paramCustomerId);

      setIsFormOpen(true);
      // URL 파라미터 정리
      router.replace(`/sales?year=${currentYear}&month=${currentMonth}`, { scroll: false });
    }
  }, [searchParams, router, currentYear, currentMonth]);

  const filteredSales = useMemo(() => {
    let result = initialSales;

    // Payment filter
    if (paymentFilter !== 'all') {
      result = result.filter(s => s.payment_method === paymentFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter(s => s.product_category === categoryFilter);
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        (s.product_category || s.product_name || '').toLowerCase().includes(q) ||
        s.customer_name?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [initialSales, paymentFilter, categoryFilter, searchQuery]);

  const summary = useMemo(() => calculateSalesSummary(filteredSales), [filteredSales]);

  // 매출 상세 선택 시 사진 로드
  const handleSelectSale = async (sale: Sale) => {
    setSelectedSale(sale);
    setSelectedSalePhotos(null);
    const photoCard = await getPhotoCardBySaleId(sale.id);
    setSelectedSalePhotos(photoCard);
  };

  const handleYearChange = (year: string) => {
    router.push(`/sales?year=${year}&month=${currentMonth}`);
  };

  const handleMonthChange = (month: string) => {
    router.push(`/sales?year=${currentYear}&month=${month}`);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      const sale = await createSale(formData);

      setIsFormOpen(false);
      router.refresh();
      toast.success('매출이 등록되었습니다');

      // 등록 후 사진 추가 여부 묻기
      setShowPhotoPrompt(sale);
    } catch (error) {
      console.error('Failed to create sale:', error);
      toast.error('매출 등록에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingSale) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      await updateSale(editingSale.id, formData);

      setEditingSale(null);
      setSelectedSale(null);
      router.refresh();
      toast.success('매출이 수정되었습니다');
    } catch (error) {
      console.error('Failed to update sale:', error);
      toast.error('매출 수정에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenPhotoModal = async (sale: Sale) => {
    setPhotoModalSale(sale);
  };

  const getDefaultPhotoTitle = (sale: Sale) => {
    const categoryLabel = categoryLabels[sale.product_category] || sale.product_category;
    return `${format(new Date(sale.date), 'M/d')} ${categoryLabel}`;
  };

  const handleEdit = (sale: Sale) => {
    setEditingSale(sale);
    setEditNoteValue(sale.note || '');
    setEditPaymentMethod(sale.payment_method);
    setEditCustomerName(sale.customer_name || '');
    setEditCustomerId(sale.customer_id || null);
    setEditCustomerPhone(sale.customer_phone || null);
    setSelectedSale(null);
  };

  const handleDelete = (sale: Sale) => {
    setDeleteTarget(sale);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteSale(deleteTarget.id);
      setDeleteTarget(null);
      setSelectedSale(null);
      router.refresh();
      toast.success('매출이 삭제되었습니다');
    } catch (error) {
      console.error('Failed to delete sale:', error);
      toast.error('매출 삭제에 실패했습니다');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">매출 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">매출 내역을 등록하고 관리하세요</p>
        </div>
        <Button onClick={() => { setIsFormOpen(true); setNoteValue(''); setSelectedPaymentMethod(payments[0]?.value || 'card'); setCustomerName(''); setCustomerId(null); setCustomerPhone(null); }}>
          <Plus className="w-4 h-4 mr-2" />
          매출 등록
        </Button>
      </div>

      {/* Summary Cards - Responsive Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">총 매출</p>
                <p className="text-lg font-bold text-foreground truncate">{formatCurrency(summary.total)}</p>
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
                <p className="text-lg font-bold text-foreground truncate">{formatCurrency(summary.card)}</p>
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
                <p className="text-lg font-bold text-foreground truncate">{formatCurrency(summary.naverpay)}</p>
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
                <p className="text-lg font-bold text-foreground truncate">{formatCurrency(summary.transfer)}</p>
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
                <p className="text-lg font-bold text-foreground truncate">{formatCurrency(summary.cash)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
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
          aria-label="매출 설정"
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
            aria-label="매출 검색"
          />
        </div>
      </div>

      {/* Desktop Table */}
      <Card className="overflow-hidden hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[120px] pl-6">날짜</TableHead>
                <TableHead className="w-[140px]">카테고리</TableHead>
                <TableHead className="w-[120px]">금액</TableHead>
                <TableHead className="w-[100px]">결제</TableHead>
                <TableHead className="w-[100px] hidden lg:table-cell">예약</TableHead>
                <TableHead className="w-[100px] hidden lg:table-cell">고객</TableHead>
                <TableHead className="hidden xl:table-cell">비고</TableHead>
                <TableHead className="w-[130px] text-right pr-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                    {(paymentFilter !== 'all' || categoryFilter !== 'all' || searchQuery) ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                          <Search className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p>선택한 필터에 맞는 매출이 없습니다</p>
                        <Button variant="outline" size="sm" onClick={() => { setPaymentFilter('all'); setCategoryFilter('all'); setSearchQuery(''); }}>
                          필터 초기화
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                          <TrendingUp className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p>등록된 매출이 없습니다</p>
                        <Button variant="outline" size="sm" onClick={() => { setIsFormOpen(true); setNoteValue(''); }}>
                          첫 매출 등록하기
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales.map((sale) => (
                  <TableRow
                    key={sale.id}
                    className="cursor-pointer hover:bg-muted/50 active:bg-muted transition-colors"
                    onClick={() => handleSelectSale(sale)}
                  >
                    <TableCell className="text-muted-foreground pl-6">{format(new Date(sale.date), 'M/d (E)', { locale: ko })}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2 py-1 text-xs font-medium rounded-md"
                          style={{
                            backgroundColor: categoryColors[sale.product_category] ? `${categoryColors[sale.product_category]}40` : '#f3f4f6',
                            color: categoryColors[sale.product_category] || '#374151'
                          }}
                        >
                          {categoryLabels[sale.product_category] || sale.product_category || sale.product_name}
                        </span>
                        {sale.photos && sale.photos.length > 0 && (
                          <ImageIcon className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">{formatCurrency(sale.amount)}</TableCell>
                    <TableCell>
                      <span
                        className="px-2 py-1 text-xs font-medium rounded-md"
                        style={{
                          backgroundColor: paymentColors[sale.payment_method] ? `${paymentColors[sale.payment_method]}40` : '#f3f4f6',
                          color: paymentColors[sale.payment_method] || '#374151'
                        }}
                      >
                        {paymentLabels[sale.payment_method] || sale.payment_method}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground truncate">{channelLabels[sale.reservation_channel]}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground truncate">{sale.customer_name || '-'}</TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground text-sm truncate" title={sale.note || ''}>
                      {sale.note || '-'}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-brand"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPhotoModal(sale);
                          }}
                          aria-label="사진 관리"
                        >
                          <ImageIcon className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(sale);
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
                            handleDelete(sale);
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
        {filteredSales.length === 0 ? (
          <Card className="p-8 text-center">
            {(paymentFilter !== 'all' || categoryFilter !== 'all' || searchQuery) ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Search className="w-8 h-8 text-muted-foreground opacity-40" />
                <p className="text-sm">선택한 필터에 맞는 매출이 없습니다</p>
                <Button variant="outline" size="sm" onClick={() => { setPaymentFilter('all'); setCategoryFilter('all'); setSearchQuery(''); }}>
                  필터 초기화
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-muted-foreground" />
                </div>
                <p>등록된 매출이 없습니다</p>
              </div>
            )}
          </Card>
        ) : (
          filteredSales.map((sale) => (
            <Card
              key={sale.id}
              className="p-4 cursor-pointer hover:bg-muted/30 active:bg-muted active:scale-[0.99] transition-colors touch-manipulation"
              onClick={() => handleSelectSale(sale)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="px-2 py-0.5 text-xs font-medium rounded flex-shrink-0"
                      style={{
                        backgroundColor: categoryColors[sale.product_category] ? `${categoryColors[sale.product_category]}40` : '#f3f4f6',
                        color: categoryColors[sale.product_category] || '#374151'
                      }}
                    >
                      {categoryLabels[sale.product_category] || sale.product_category || sale.product_name}
                    </span>
                    {sale.photos && sale.photos.length > 0 && (
                      <ImageIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="text-muted-foreground flex-shrink-0">{format(new Date(sale.date), 'M/d')}</span>
                    <span
                      className="px-2 py-0.5 text-xs font-medium rounded flex-shrink-0"
                      style={{
                        backgroundColor: paymentColors[sale.payment_method] ? `${paymentColors[sale.payment_method]}40` : '#f3f4f6',
                        color: paymentColors[sale.payment_method] || '#374151'
                      }}
                    >
                      {paymentLabels[sale.payment_method] || sale.payment_method}
                    </span>
                    {sale.customer_name && (
                      <span className="text-muted-foreground truncate max-w-[80px]">{sale.customer_name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-bold text-foreground whitespace-nowrap">{formatCurrency(sale.amount)}</span>
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
            <DialogTitle className="text-xl">매출 등록</DialogTitle>
            <p className="text-sm text-muted-foreground">오늘 판매한 내역을 입력해주세요. * 표시는 필수 항목이에요.</p>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="space-y-5 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>날짜 *</Label>
                <Input type="date" name="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>금액 *</Label>
                <AmountInput name="amount" placeholder="0" required className="bg-muted" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>상품 카테고리 *</Label>
              <Select name="product_category" required>
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
            <div className="grid grid-cols-2 gap-4">
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
              {selectedPaymentMethod === 'card' ? (
                <div className="space-y-2">
                  <Label>카드사 *</Label>
                  <Select name="card_company" required>
                    <SelectTrigger className="bg-muted">
                      <SelectValue placeholder="카드사 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {cardCompanies.map(cc => (
                        <SelectItem key={cc.id} value={cc.name}>{cc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">카드사별 수수료가 자동 계산돼요</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>예약방식</Label>
                  <Select name="reservation_channel" defaultValue="naver_booking">
                    <SelectTrigger className="bg-muted">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone">전화</SelectItem>
                      <SelectItem value="kakaotalk">카카오톡</SelectItem>
                      <SelectItem value="naver_booking">네이버예약</SelectItem>
                      <SelectItem value="road">로드</SelectItem>
                      <SelectItem value="other">기타</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {selectedPaymentMethod === 'card' && (
              <div className="space-y-2">
                <Label>예약방식</Label>
                <Select name="reservation_channel" defaultValue="naver_booking">
                  <SelectTrigger className="bg-muted">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">전화</SelectItem>
                    <SelectItem value="kakaotalk">카카오톡</SelectItem>
                    <SelectItem value="naver_booking">네이버예약</SelectItem>
                    <SelectItem value="road">로드</SelectItem>
                    <SelectItem value="other">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>주문자명</Label>
                <CustomerAutocomplete
                  value={customerName}
                  onChange={(name, id, phone) => {
                    setCustomerName(name);
                    setCustomerId(id);
                    setCustomerPhone(phone);
                  }}
                  placeholder="고객명 검색 또는 입력"
                />
                <p className="text-[11px] text-muted-foreground">이름을 입력하면 기존 고객이 자동 검색돼요</p>
              </div>
              <div className="space-y-2">
                <Label>연락처</Label>
                <Input
                  name="customer_phone"
                  value={customerPhone || ''}
                  onChange={(e) => setCustomerPhone(formatPhoneNumber(e.target.value))}
                  placeholder="010-0000-0000"
                  className="bg-muted"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
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
                placeholder="추가 정보를 입력하세요"
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


      {/* Sale Detail Dialog */}
      <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">매출 상세</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">날짜</p>
                  <p className="font-medium">{format(new Date(selectedSale.date), 'yyyy년 M월 d일', { locale: ko })}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">금액</p>
                  <p className="font-bold text-lg text-brand">{formatCurrency(selectedSale.amount)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">카테고리</p>
                  <span
                    className="inline-block px-2 py-1 text-xs font-medium rounded-md"
                    style={{
                      backgroundColor: categoryColors[selectedSale.product_category] ? `${categoryColors[selectedSale.product_category]}40` : '#f3f4f6',
                      color: categoryColors[selectedSale.product_category] || '#374151'
                    }}
                  >
                    {categoryLabels[selectedSale.product_category] || selectedSale.product_category || selectedSale.product_name}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">결제방식</p>
                  <span
                    className="inline-block px-2 py-1 text-xs font-medium rounded-md"
                    style={{
                      backgroundColor: paymentColors[selectedSale.payment_method] ? `${paymentColors[selectedSale.payment_method]}40` : '#f3f4f6',
                      color: paymentColors[selectedSale.payment_method] || '#374151'
                    }}
                  >
                    {paymentLabels[selectedSale.payment_method] || selectedSale.payment_method}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">예약방식</p>
                  <p className="font-medium">{channelLabels[selectedSale.reservation_channel]}</p>
                </div>
                {selectedSale.customer_name && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">고객명</p>
                    <p className="font-medium">{selectedSale.customer_name}</p>
                  </div>
                )}
              </div>

              {selectedSale.customer_phone && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">연락처</p>
                  <p className="font-medium">{selectedSale.customer_phone}</p>
                </div>
              )}

              {selectedSale.note && (
                <div className="space-y-1 pt-2 border-t">
                  <p className="text-sm text-muted-foreground">비고</p>
                  <p className="text-foreground">{selectedSale.note}</p>
                </div>
              )}

              {selectedSalePhotos && selectedSalePhotos.photos.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-sm text-muted-foreground">사진</p>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedSalePhotos.photos.slice(0, 6).map((photo, index) => (
                      <div key={photo.url} className="relative aspect-square">
                        <img
                          src={photo.url}
                          alt={`사진 ${index + 1}`}
                          className="w-full h-full object-cover rounded-lg"
                        />
                        {index === 5 && selectedSalePhotos.photos.length > 6 && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                            <span className="text-white font-medium">+{selectedSalePhotos.photos.length - 6}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4 border-t">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleOpenPhotoModal(selectedSale);
                      setSelectedSale(null);
                    }}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    사진
                  </Button>
                  <Button variant="outline" onClick={() => handleEdit(selectedSale)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    수정
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      handleDelete(selectedSale);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    삭제
                  </Button>
                </div>
                <Button variant="outline" onClick={() => setSelectedSale(null)}>
                  닫기
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingSale} onOpenChange={(open) => !open && setEditingSale(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">매출 수정</DialogTitle>
          </DialogHeader>
          {editingSale && (
            <form onSubmit={(e) => { e.preventDefault(); handleUpdate(e); }} className="space-y-5 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>날짜 *</Label>
                  <Input type="date" name="date" defaultValue={editingSale.date} required className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>금액 *</Label>
                  <AmountInput name="amount" value={editingSale.amount} required className="bg-muted" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>상품 카테고리 *</Label>
                <Select name="product_category" defaultValue={editingSale.product_category} key={`cat-${editingSale.id}`} required>
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
              <div className="grid grid-cols-2 gap-4">
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
                {editPaymentMethod === 'card' ? (
                  <div className="space-y-2">
                    <Label>카드사 *</Label>
                    <Select name="card_company" defaultValue={editingSale.card_company || ''} key={`cc-${editingSale.id}`} required>
                      <SelectTrigger className="bg-muted">
                        <SelectValue placeholder="카드사 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {cardCompanies.map(cc => (
                          <SelectItem key={cc.id} value={cc.name}>{cc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>예약방식</Label>
                    <Select name="reservation_channel" defaultValue={editingSale.reservation_channel} key={`ch-${editingSale.id}`}>
                      <SelectTrigger className="bg-muted">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="phone">전화</SelectItem>
                        <SelectItem value="kakaotalk">카카오톡</SelectItem>
                        <SelectItem value="naver_booking">네이버예약</SelectItem>
                        <SelectItem value="road">로드</SelectItem>
                        <SelectItem value="other">기타</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {editPaymentMethod === 'card' && (
                <div className="space-y-2">
                  <Label>예약방식</Label>
                  <Select name="reservation_channel" defaultValue={editingSale.reservation_channel} key={`ch2-${editingSale.id}`}>
                    <SelectTrigger className="bg-muted">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone">전화</SelectItem>
                      <SelectItem value="kakaotalk">카카오톡</SelectItem>
                      <SelectItem value="naver_booking">네이버예약</SelectItem>
                      <SelectItem value="road">로드</SelectItem>
                      <SelectItem value="other">기타</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>주문자명</Label>
                  <CustomerAutocomplete
                    value={editCustomerName}
                    onChange={(name, id, phone) => {
                      setEditCustomerName(name);
                      setEditCustomerId(id);
                      setEditCustomerPhone(phone);
                    }}
                    placeholder="고객명 검색 또는 입력"
                  />
                </div>
                <div className="space-y-2">
                  <Label>연락처</Label>
                  <Input
                    name="customer_phone"
                    value={editCustomerPhone || ''}
                    onChange={(e) => setEditCustomerPhone(formatPhoneNumber(e.target.value))}
                    placeholder="010-0000-0000"
                    className="bg-muted"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </div>
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
                  placeholder="추가 정보를 입력하세요"
                  className="bg-muted min-h-[60px] resize-none"
                  maxLength={100}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setEditingSale(null)}>취소</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isSubmitting ? '저장 중...' : '저장'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Photo Prompt Dialog */}
      <Dialog open={!!showPhotoPrompt} onOpenChange={(open) => !open && setShowPhotoPrompt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>사진 추가</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground text-sm">매출이 등록되었습니다. 완성한 꽃 사진을 추가하면 사진첩에서도 볼 수 있어요.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPhotoPrompt(null)}>
              나중에
            </Button>
            <Button
              onClick={() => {
                if (showPhotoPrompt) {
                  setPhotoModalSale(showPhotoPrompt);
                }
                setShowPhotoPrompt(null);
              }}
            >
              사진 추가
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sale Photo Modal */}
      {photoModalSale && (
        <SalePhotoModal
          open={!!photoModalSale}
          onClose={() => setPhotoModalSale(null)}
          saleId={photoModalSale.id}
          defaultTitle={getDefaultPhotoTitle(photoModalSale)}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>매출 삭제</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground text-sm">
              이 매출 기록을 삭제하시겠습니까?
            </p>
            {deleteTarget && (
              <p className="text-muted-foreground text-xs mt-2">
                {format(new Date(deleteTarget.date), 'M월 d일', { locale: ko })} · {formatCurrency(deleteTarget.amount)}
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

      {/* Sales Settings Modal */}
      <SalesSettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        categories={categories}
        onRefresh={refreshSettings}
      />
    </div>
  );
}

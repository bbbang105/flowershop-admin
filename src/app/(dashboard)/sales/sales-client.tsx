'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search, Settings, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { deleteSale } from '@/lib/actions/sales';
import { getPhotoCardBySaleId } from '@/lib/actions/photo-cards';
import { SalePhotoModal } from '@/components/sales/SalePhotoModal';
import { SalesSettingsModal } from '@/components/sales/SalesSettingsModal';
import { calculateSalesSummary, formatCurrency } from '@/lib/utils';
import type { PhotoCard, Sale, CardCompanySetting } from '@/types/database';
import { SaleCategory, PaymentMethod, getSaleCategories, getPaymentMethods } from '@/lib/actions/sale-settings';
import { getCardCompanySettings } from '@/lib/actions/settings';
import { ExportButton } from '@/components/ui/export-button';
import type { ExportConfig } from '@/lib/export';
import { CHANNEL_LABELS } from '@/lib/constants';
import { SalesSummary } from './components/SalesSummary';
import { SalesTable } from './components/SalesTable';
import { SaleFormDialog } from './components/SaleFormDialog';
import { SaleDetailDialog } from './components/SaleDetailDialog';

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
  const [photoModalSale, setPhotoModalSale] = useState<Sale | null>(null);
  const [showPhotoPrompt, setShowPhotoPrompt] = useState<Sale | null>(null);
  const [selectedSalePhotos, setSelectedSalePhotos] = useState<PhotoCard | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [categories, setCategories] = useState<SaleCategory[]>(initialCategories);
  const [payments, setPayments] = useState<PaymentMethod[]>(initialPayments);
  const [cardCompanies, setCardCompanies] = useState<CardCompanySetting[]>(initialCardCompanies);
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [initialCustomer, setInitialCustomer] = useState<{ name: string; id: string | null; phone: string | null } | undefined>();

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

      if (paramCustomerName) {
        setInitialCustomer({
          name: paramCustomerName,
          id: paramCustomerId,
          phone: paramCustomerPhone,
        });
      }

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

  const hasActiveFilters = paymentFilter !== 'all' || categoryFilter !== 'all' || searchQuery !== '';

  const getExportConfig = useCallback((): ExportConfig<Sale> => ({
    filename: `매출_${currentYear}-${String(currentMonth).padStart(2, '0')}`,
    title: `매출 내역 (${currentYear}년 ${currentMonth}월)`,
    columns: [
      { header: '날짜', accessor: (s) => String(s.date || '') },
      { header: '카테고리', accessor: (s) => categoryLabels[s.product_category] || s.product_category || '' },
      { header: '금액', accessor: (s) => Number(s.amount) || 0, format: 'currency' },
      { header: '결제방법', accessor: (s) => paymentLabels[s.payment_method] || s.payment_method || '' },
      { header: '채널', accessor: (s) => CHANNEL_LABELS[s.reservation_channel] || '' },
      { header: '고객명', accessor: (s) => String(s.customer_name || '') },
      { header: '비고', accessor: (s) => String(s.note || '') },
    ],
    data: filteredSales,
  }), [filteredSales, currentYear, currentMonth, categoryLabels, paymentLabels]);

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

  const handleOpenPhotoModal = async (sale: Sale) => {
    setPhotoModalSale(sale);
  };

  const getDefaultPhotoTitle = (sale: Sale) => {
    const categoryLabel = categoryLabels[sale.product_category] || sale.product_category;
    return `${format(new Date(sale.date), 'M/d')} ${categoryLabel}`;
  };

  const handleEdit = (sale: Sale) => {
    setEditingSale(sale);
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

  const handleFormSuccess = (newSale?: Sale) => {
    router.refresh();
    if (newSale) {
      setShowPhotoPrompt(newSale);
    }
  };

  const handleResetFilters = () => {
    setPaymentFilter('all');
    setCategoryFilter('all');
    setSearchQuery('');
  };

  const handleOpenForm = () => {
    setInitialCustomer(undefined);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">매출 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">매출 내역을 등록하고 관리하세요</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton getExportConfig={getExportConfig} />
          <Button onClick={handleOpenForm}>
            <Plus className="w-4 h-4 mr-2" />
            매출 등록
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <SalesSummary summary={summary} />

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

      {/* Sales Table and Mobile List */}
      <SalesTable
        sales={filteredSales}
        categoryLabels={categoryLabels}
        categoryColors={categoryColors}
        paymentLabels={paymentLabels}
        paymentColors={paymentColors}
        hasActiveFilters={hasActiveFilters}
        onSelectSale={handleSelectSale}
        onEditSale={handleEdit}
        onDeleteSale={handleDelete}
        onPhotoModal={handleOpenPhotoModal}
        onResetFilters={handleResetFilters}
        onOpenForm={handleOpenForm}
      />

      {/* Sale Form Dialog (Create/Edit) */}
      <SaleFormDialog
        open={isFormOpen || !!editingSale}
        onOpenChange={(open) => {
          if (!open) {
            setIsFormOpen(false);
            setEditingSale(null);
          }
        }}
        sale={editingSale}
        categories={categories}
        payments={payments}
        cardCompanies={cardCompanies}
        initialCustomer={initialCustomer}
        onSuccess={handleFormSuccess}
      />

      {/* Sale Detail Dialog */}
      <SaleDetailDialog
        sale={selectedSale}
        photos={selectedSalePhotos}
        categoryLabels={categoryLabels}
        categoryColors={categoryColors}
        paymentLabels={paymentLabels}
        paymentColors={paymentColors}
        onClose={() => setSelectedSale(null)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPhotoModal={handleOpenPhotoModal}
      />

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

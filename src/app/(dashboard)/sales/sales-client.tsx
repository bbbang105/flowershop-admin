'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AmountInput } from '@/components/ui/amount-input';
import { Plus, Search, Trash2, ImageIcon, ChevronRight, CreditCard, Banknote, TrendingUp, Loader2, Wallet, Building2, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { createSale, updateSale, deleteSale } from '@/lib/actions/sales';
import { calculateSalesSummary, filterSalesByCategory } from '@/lib/utils';
import type { Sale, ProductCategory } from '@/types/database';
import { PRODUCT_CATEGORIES, PAYMENT_METHODS } from '@/types/database';

const paymentLabels: Record<string, string> = {
  cash: '현금', card: '카드', transfer: '계좌이체', naverpay: '네이버페이',
};

const categoryLabels: Record<string, string> = Object.fromEntries(
  PRODUCT_CATEGORIES.map(c => [c.value, c.label])
);

const channelLabels: Record<string, string> = {
  phone: '전화', kakaotalk: '카카오톡', naver_booking: '네이버예약', road: '로드', other: '기타',
};

const paymentColors: Record<string, string> = {
  cash: 'bg-green-50 text-green-700',
  card: 'bg-blue-50 text-blue-700',
  transfer: 'bg-purple-50 text-purple-700',
  naverpay: 'bg-emerald-50 text-emerald-700',
};

// 카테고리 색상 (꽃다발류는 rose, 나머지는 각각 다른 색상)
const categoryColors: Record<string, string> = {
  mini_bouquet: 'bg-rose-50 text-rose-700',
  basic_bouquet: 'bg-rose-50 text-rose-700',
  medium_bouquet: 'bg-rose-50 text-rose-700',
  large_bouquet: 'bg-rose-50 text-rose-700',
  special_bouquet: 'bg-rose-50 text-rose-700',
  proposal_bouquet: 'bg-rose-50 text-rose-700',
  basket: 'bg-amber-50 text-amber-700',
  vase: 'bg-cyan-50 text-cyan-700',
  group_bouquet: 'bg-indigo-50 text-indigo-700',
  reservation: 'bg-orange-50 text-orange-700',
  photo_bouquet: 'bg-pink-50 text-pink-700',
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
}

export function SalesClient({ initialSales, currentYear, currentMonth }: Props) {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredSales = useMemo(() => {
    let result = initialSales;
    
    // Payment filter
    if (paymentFilter !== 'all') {
      result = result.filter(s => s.payment_method === paymentFilter);
    }
    
    // Category filter
    result = filterSalesByCategory(result, categoryFilter);
    
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => 
        (categoryLabels[s.product_category] || s.product_name || '').toLowerCase().includes(q) || 
        s.customer_name?.toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [initialSales, paymentFilter, categoryFilter, searchQuery]);
  
  const summary = useMemo(() => calculateSalesSummary(filteredSales), [filteredSales]);

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
      await createSale(formData);
      setIsFormOpen(false);
      router.refresh();
      toast.success('매출이 등록되었습니다');
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

  const handleEdit = (sale: Sale) => {
    setEditingSale(sale);
    setSelectedSale(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await deleteSale(id);
      router.refresh();
      toast.success('매출이 삭제되었습니다');
    } catch (error) {
      console.error('Failed to delete sale:', error);
      toast.error('매출 삭제에 실패했습니다');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">매출 관리</h1>
          <p className="text-gray-500 mt-1">매출 내역을 등록하고 관리하세요</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="bg-rose-500 hover:bg-rose-600">
          <Plus className="w-4 h-4 mr-2" />
          매출 등록
        </Button>
      </div>

      {/* Summary Cards - Responsive Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-rose-50 to-white col-span-2 sm:col-span-1">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-rose-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-rose-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-500">총 매출</p>
                <p className="text-base sm:text-xl font-bold text-gray-900 truncate">{formatCurrency(summary.total)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-500">카드</p>
                <p className="text-base sm:text-xl font-bold text-gray-900 truncate">{formatCurrency(summary.card)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-500">네이버페이</p>
                <p className="text-base sm:text-xl font-bold text-gray-900 truncate">{formatCurrency(summary.naverpay)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-500">계좌이체</p>
                <p className="text-base sm:text-xl font-bold text-gray-900 truncate">{formatCurrency(summary.transfer)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Banknote className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-500">현금</p>
                <p className="text-base sm:text-xl font-bold text-gray-900 truncate">{formatCurrency(summary.cash)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Filters */}
      <div className="flex gap-2 sm:gap-3 flex-wrap">
        <Select value={currentYear.toString()} onValueChange={handleYearChange}>
          <SelectTrigger className="w-[100px] bg-white border-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEAR_OPTIONS.map(year => (
              <SelectItem key={year} value={year.toString()}>{year}년</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={currentMonth.toString()} onValueChange={handleMonthChange}>
          <SelectTrigger className="w-[80px] bg-white border-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_OPTIONS.map(month => (
              <SelectItem key={month} value={month.toString()}>{month}월</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as ProductCategory | 'all')}>
          <SelectTrigger className="w-auto min-w-[140px] bg-white border-gray-200">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">카테고리</span>
              {categoryFilter === 'all' ? (
                <span>전체</span>
              ) : (
                <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${categoryColors[categoryFilter]}`}>
                  {categoryLabels[categoryFilter]}
                </span>
              )}
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {PRODUCT_CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>
                <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${categoryColors[cat.value]}`}>
                  {cat.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-auto min-w-[120px] bg-white border-gray-200">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">결제</span>
              {paymentFilter === 'all' ? (
                <span>전체</span>
              ) : (
                <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${paymentColors[paymentFilter]}`}>
                  {paymentLabels[paymentFilter]}
                </span>
              )}
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {PAYMENT_METHODS.map(pm => (
              <SelectItem key={pm.value} value={pm.value}>
                <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${paymentColors[pm.value]}`}>
                  {pm.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[150px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white border-gray-200"
          />
        </div>
      </div>

      {/* Desktop Table */}
      <Card className="border-0 shadow-sm overflow-hidden hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="font-semibold text-gray-700 w-[90px]">날짜</TableHead>
                <TableHead className="font-semibold text-gray-700">카테고리</TableHead>
                <TableHead className="font-semibold text-gray-700">금액</TableHead>
                <TableHead className="font-semibold text-gray-700 w-[100px]">결제</TableHead>
                <TableHead className="font-semibold text-gray-700 hidden lg:table-cell">예약</TableHead>
                <TableHead className="font-semibold text-gray-700 hidden lg:table-cell">고객</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-gray-400" />
                      </div>
                      <p>등록된 매출이 없습니다</p>
                      <Button variant="outline" size="sm" onClick={() => setIsFormOpen(true)}>
                        첫 매출 등록하기
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales.map((sale) => (
                  <TableRow 
                    key={sale.id} 
                    className="cursor-pointer hover:bg-gray-50/50 transition-colors"
                    onClick={() => setSelectedSale(sale)}
                  >
                    <TableCell className="text-gray-600">{format(new Date(sale.date), 'M/d (E)', { locale: ko })}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-md ${categoryColors[sale.product_category] || 'bg-gray-100 text-gray-700'}`}>
                          {categoryLabels[sale.product_category] || sale.product_name}
                        </span>
                        {sale.photos && sale.photos.length > 0 && (
                          <ImageIcon className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-gray-900">{formatCurrency(sale.amount)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs font-medium rounded-md ${paymentColors[sale.payment_method] || 'bg-gray-100 text-gray-700'}`}>
                        {paymentLabels[sale.payment_method]}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-gray-600">{channelLabels[sale.reservation_channel]}</TableCell>
                    <TableCell className="hidden lg:table-cell text-gray-600">{sale.customer_name || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-blue-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(sale);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-red-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(sale.id);
                          }}
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
          <Card className="border-0 shadow-sm p-8 text-center">
            <div className="flex flex-col items-center gap-2 text-gray-500">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-gray-400" />
              </div>
              <p>등록된 매출이 없습니다</p>
            </div>
          </Card>
        ) : (
          filteredSales.map((sale) => (
            <Card 
              key={sale.id}
              className="border-0 shadow-sm p-4 cursor-pointer hover:shadow-md active:bg-gray-50 transition-all"
              onClick={() => setSelectedSale(sale)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${categoryColors[sale.product_category] || 'bg-gray-100 text-gray-700'}`}>
                      {categoryLabels[sale.product_category] || sale.product_name}
                    </span>
                    {sale.photos && sale.photos.length > 0 && (
                      <ImageIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">{format(new Date(sale.date), 'M/d')}</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${paymentColors[sale.payment_method] || 'bg-gray-100 text-gray-700'}`}>
                      {paymentLabels[sale.payment_method]}
                    </span>
                    {sale.customer_name && (
                      <span className="text-gray-500 truncate">{sale.customer_name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <span className="font-bold text-gray-900">{formatCurrency(sale.amount)}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
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
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>날짜 *</Label>
                <Input type="date" name="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required className="bg-gray-50" />
              </div>
              <div className="space-y-2">
                <Label>금액 *</Label>
                <AmountInput name="amount" placeholder="0" required className="bg-gray-50" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>상품 카테고리 *</Label>
              <Select name="product_category" required>
                <SelectTrigger className="bg-gray-50">
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>결제방식 *</Label>
                <Select name="payment_method" defaultValue="naverpay">
                  <SelectTrigger className="bg-gray-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(pm => (
                      <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>예약방식</Label>
                <Select name="reservation_channel" defaultValue="naver_booking">
                  <SelectTrigger className="bg-gray-50">
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>주문자명</Label>
                <Input name="customer_name" placeholder="홍길동" className="bg-gray-50" />
              </div>
              <div className="space-y-2">
                <Label>연락처</Label>
                <Input name="customer_phone" placeholder="010-0000-0000" className="bg-gray-50" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>비고</Label>
              <Input name="note" placeholder="추가 정보를 입력하세요" className="bg-gray-50" />
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
                  <p className="text-sm text-gray-500">날짜</p>
                  <p className="font-medium">{format(new Date(selectedSale.date), 'yyyy년 M월 d일', { locale: ko })}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">금액</p>
                  <p className="font-bold text-lg text-rose-600">{formatCurrency(selectedSale.amount)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">카테고리</p>
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded-md ${categoryColors[selectedSale.product_category] || 'bg-gray-100 text-gray-700'}`}>
                    {categoryLabels[selectedSale.product_category] || selectedSale.product_name}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">결제방식</p>
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded-md ${paymentColors[selectedSale.payment_method]}`}>
                    {paymentLabels[selectedSale.payment_method]}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">예약방식</p>
                  <p className="font-medium">{channelLabels[selectedSale.reservation_channel]}</p>
                </div>
                {selectedSale.customer_name && (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">고객명</p>
                    <p className="font-medium">{selectedSale.customer_name}</p>
                  </div>
                )}
              </div>
              
              {selectedSale.customer_phone && (
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">연락처</p>
                  <p className="font-medium">{selectedSale.customer_phone}</p>
                </div>
              )}
              
              {selectedSale.note && (
                <div className="space-y-1 pt-2 border-t">
                  <p className="text-sm text-gray-500">비고</p>
                  <p className="text-gray-700">{selectedSale.note}</p>
                </div>
              )}

              <div className="flex justify-between pt-4 border-t">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleEdit(selectedSale)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    수정
                  </Button>
                  <Button 
                    variant="outline" 
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => {
                      handleDelete(selectedSale.id);
                      setSelectedSale(null);
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
            <form onSubmit={handleUpdate} className="space-y-5 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>날짜 *</Label>
                  <Input type="date" name="date" defaultValue={editingSale.date} required className="bg-gray-50" />
                </div>
                <div className="space-y-2">
                  <Label>금액 *</Label>
                  <AmountInput name="amount" value={editingSale.amount} required className="bg-gray-50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>상품 카테고리 *</Label>
                <Select name="product_category" defaultValue={editingSale.product_category} key={`cat-${editingSale.id}`} required>
                  <SelectTrigger className="bg-gray-50">
                    <SelectValue placeholder="카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>결제방식 *</Label>
                  <Select name="payment_method" defaultValue={editingSale.payment_method} key={`pm-${editingSale.id}`}>
                    <SelectTrigger className="bg-gray-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(pm => (
                        <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>예약방식</Label>
                  <Select name="reservation_channel" defaultValue={editingSale.reservation_channel} key={`ch-${editingSale.id}`}>
                    <SelectTrigger className="bg-gray-50">
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
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>주문자명</Label>
                  <Input name="customer_name" defaultValue={editingSale.customer_name || ''} placeholder="홍길동" className="bg-gray-50" />
                </div>
                <div className="space-y-2">
                  <Label>연락처</Label>
                  <Input name="customer_phone" defaultValue={editingSale.customer_phone || ''} placeholder="010-0000-0000" className="bg-gray-50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>비고</Label>
                <Input name="note" defaultValue={editingSale.note || ''} placeholder="추가 정보를 입력하세요" className="bg-gray-50" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setEditingSale(null)}>취소</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-rose-500 hover:bg-rose-600">
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isSubmitting ? '저장 중...' : '저장'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

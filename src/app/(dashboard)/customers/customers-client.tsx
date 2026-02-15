'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search, Users, Loader2, CalendarDays, Crown, Star, AlertTriangle, UserPlus } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import { deleteCustomer, getCustomerSales } from '@/lib/actions/customers';
import { cn } from '@/lib/utils';
import type { Customer, Sale } from '@/types/database';
import { ExportButton } from '@/components/ui/export-button';
import type { ExportConfig } from '@/lib/export';
import type { SaleCategory } from '@/lib/actions/sale-settings';
import { CustomerCard, gradeLabels, genderLabels } from './components/CustomerCard';
import { CustomerFormDialog } from './components/CustomerFormDialog';
import { CustomerDetailDialog } from './components/CustomerDetailDialog';

const gradeSections = [
  { key: 'vip', label: 'VIP', icon: Crown, iconColor: 'text-purple-600 dark:text-purple-400' },
  { key: 'regular', label: '단골', icon: Star, iconColor: 'text-yellow-600 dark:text-yellow-400' },
  { key: 'new', label: '신규', icon: UserPlus, iconColor: 'text-muted-foreground' },
  { key: 'blacklist', label: '블랙리스트', icon: AlertTriangle, iconColor: 'text-red-600 dark:text-red-400' },
] as const;

type SortBy = 'newest' | 'oldest' | 'name' | 'purchase_count' | 'purchase_amount';
type GenderFilter = 'all' | 'male' | 'female';

interface Props {
  initialCustomers: Customer[];
  initialCategories: SaleCategory[];
}

export function CustomersClient({ initialCustomers, initialCategories }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [gradeFilter, setGradeFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [customerSales, setCustomerSales] = useState<Sale[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Category/Payment method label maps
  const categoryLabels = useMemo(() =>
    Object.fromEntries(initialCategories.map(c => [c.value, c.label])), [initialCategories]);
  const categoryColors = useMemo(() =>
    Object.fromEntries(initialCategories.map(c => [c.value, c.color])), [initialCategories]);

  // Sort function
  const sortCustomers = useCallback((customers: Customer[]) => {
    return [...customers].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name':
          return a.name.localeCompare(b.name, 'ko');
        case 'purchase_count':
          return b.total_purchase_count - a.total_purchase_count;
        case 'purchase_amount':
          return b.total_purchase_amount - a.total_purchase_amount;
        default:
          return 0;
      }
    });
  }, [sortBy]);

  const filteredCustomers = useMemo(() => {
    const filtered = initialCustomers
      .filter(c => gradeFilter === 'all' || c.grade === gradeFilter)
      .filter(c => genderFilter === 'all' || c.gender === genderFilter)
      .filter(c => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.phone.includes(q);
      });
    return sortCustomers(filtered);
  }, [initialCustomers, gradeFilter, genderFilter, searchQuery, sortCustomers]);

  // Group by grade (only when grade filter is 'all')
  const groupedByGrade = useMemo(() => {
    if (gradeFilter !== 'all') return null;
    const groups: Record<string, Customer[]> = {};
    for (const customer of filteredCustomers) {
      const grade = customer.grade || 'new';
      if (!groups[grade]) groups[grade] = [];
      groups[grade].push(customer);
    }
    return groups;
  }, [filteredCustomers, gradeFilter]);

  const stats = useMemo(() => {
    const total = initialCustomers.length;
    const regularVip = initialCustomers.filter(c => c.grade === 'regular' || c.grade === 'vip').length;
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const recentBuyers = initialCustomers.filter(c => c.last_purchase_date && c.last_purchase_date >= thirtyDaysAgo).length;
    return { total, regularVip, recentBuyers };
  }, [initialCustomers]);

  const hasActiveFilters = gradeFilter !== 'all' || genderFilter !== 'all' || searchQuery !== '' || sortBy !== 'newest';

  const resetFilters = () => {
    setGradeFilter('all');
    setGenderFilter('all');
    setSearchQuery('');
    setSortBy('newest');
  };

  const getExportConfig = useCallback((): ExportConfig<Customer> => ({
    filename: `고객_${format(new Date(), 'yyyy-MM-dd')}`,
    title: '고객 목록',
    columns: [
      { header: '이름', accessor: (c) => String(c.name || '') },
      { header: '전화번호', accessor: (c) => String(c.phone || '') },
      { header: '등급', accessor: (c) => gradeLabels[c.grade]?.label || c.grade || '' },
      { header: '성별', accessor: (c) => c.gender ? genderLabels[c.gender] || '' : '' },
      { header: '구매횟수', accessor: (c) => Number(c.total_purchase_count) || 0 },
      { header: '총구매금액', accessor: (c) => Number(c.total_purchase_amount) || 0, format: 'currency' },
      { header: '최근구매일', accessor: (c) => String(c.last_purchase_date || '') },
      { header: '메모', accessor: (c) => String(c.note || '') },
    ],
    data: filteredCustomers,
  }), [filteredCustomers]);

  const handleSelectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSales([]);
    setIsLoadingSales(true);
    try {
      const sales = await getCustomerSales(customer.id);
      setCustomerSales(sales || []);
    } catch (error) {
      console.error('Failed to load customer sales:', error);
    } finally {
      setIsLoadingSales(false);
    }
  };

  // URL 파라미터로 고객 상세 자동 오픈 (매출 페이지에서 연결)
  useEffect(() => {
    const customerId = searchParams.get('customerId');
    if (customerId) {
      const customer = initialCustomers.find(c => c.id === customerId);
      if (customer) {
        handleSelectCustomer(customer);
      }
      router.replace('/customers', { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFormSuccess = () => {
    router.refresh();
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setSelectedCustomer(null);
  };

  const handleDelete = async (customer: Customer) => {
    setDeleteTarget(customer);
    setSelectedCustomer(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteCustomer(deleteTarget.id);
      setDeleteTarget(null);
      router.refresh();
      toast.success('고객이 삭제되었습니다');
    } catch (error) {
      console.error('Failed to delete customer:', error);
      toast.error('고객 삭제에 실패했습니다');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaleRegister = (customer: Customer) => {
    const params = new URLSearchParams({
      action: 'create',
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_id: customer.id,
    });
    router.push(`/sales?${params.toString()}`);
    setSelectedCustomer(null);
  };

  const handleOpenCreateForm = () => {
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">고객 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">고객 정보와 구매 이력을 관리하세요</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton getExportConfig={getExportConfig} />
          <Button onClick={handleOpenCreateForm}>
            <Plus className="w-4 h-4 mr-2" />
            고객 등록
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col items-center text-center gap-1.5 sm:flex-row sm:text-left sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-muted rounded-lg flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">전체 고객</p>
                <p className="text-lg sm:text-xl font-bold text-foreground tabular-nums">{stats.total}<span className="text-sm font-medium">명</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col items-center text-center gap-1.5 sm:flex-row sm:text-left sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-muted rounded-lg flex items-center justify-center shrink-0">
                <span className="text-base sm:text-lg">🌟</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">단골/VIP</p>
                <p className="text-lg sm:text-xl font-bold text-foreground tabular-nums">{stats.regularVip}<span className="text-sm font-medium">명</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col items-center text-center gap-1.5 sm:flex-row sm:text-left sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-muted rounded-lg flex items-center justify-center shrink-0">
                <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">최근 30일</p>
                <p className="text-lg sm:text-xl font-bold text-foreground tabular-nums">{stats.recentBuyers}<span className="text-sm font-medium">명</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={gradeFilter} onValueChange={setGradeFilter}>
          <SelectTrigger className="w-[120px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 등급</SelectItem>
            <SelectItem value="new">신규</SelectItem>
            <SelectItem value="regular">단골</SelectItem>
            <SelectItem value="vip">VIP</SelectItem>
            <SelectItem value="blacklist">블랙리스트</SelectItem>
          </SelectContent>
        </Select>
        <Select value={genderFilter} onValueChange={(v) => setGenderFilter(v as GenderFilter)}>
          <SelectTrigger className="w-[110px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 성별</SelectItem>
            <SelectItem value="male">남성</SelectItem>
            <SelectItem value="female">여성</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
          <SelectTrigger className="w-[130px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">최신순</SelectItem>
            <SelectItem value="oldest">오래된순</SelectItem>
            <SelectItem value="name">가나다순</SelectItem>
            <SelectItem value="purchase_count">구매횟수순</SelectItem>
            <SelectItem value="purchase_amount">구매금액순</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="이름/연락처 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background"
            aria-label="고객 검색"
          />
        </div>
        <p className="text-sm text-muted-foreground ml-auto shrink-0">
          {filteredCustomers.length}명{filteredCustomers.length !== initialCustomers.length && ` / 전체 ${initialCustomers.length}명`}
        </p>
      </div>

      {/* Customer Card Grid */}
      {filteredCustomers.length === 0 ? (
        <Card className="p-12 text-center">
          {hasActiveFilters ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                <Search className="w-6 h-6 text-muted-foreground" />
              </div>
              <p>선택한 필터에 맞는 고객이 없습니다</p>
              <Button variant="outline" size="sm" onClick={resetFilters}>
                필터 초기화
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-muted-foreground" />
              </div>
              <p>등록된 고객이 없습니다</p>
              <Button variant="outline" size="sm" onClick={handleOpenCreateForm}>
                첫 고객 등록하기
              </Button>
            </div>
          )}
        </Card>
      ) : groupedByGrade ? (
        // Group by grade section
        <div className="space-y-6">
          {gradeSections.map(({ key, label, icon: Icon, iconColor }) => {
            const customers = groupedByGrade[key];
            if (!customers || customers.length === 0) return null;
            return (
              <div key={key}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={cn('w-4 h-4', iconColor)} />
                  <h2 className="text-sm font-semibold text-foreground">{label}</h2>
                  <span className="text-xs text-muted-foreground">{customers.length}명</span>
                  <div className="flex-1 border-t border-border ml-2" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {customers.map((customer) => (
                    <CustomerCard
                      key={customer.id}
                      customer={customer}
                      onSelect={handleSelectCustomer}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Specific grade filter → flat grid
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredCustomers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onSelect={handleSelectCustomer}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Form Dialog */}
      <CustomerFormDialog
        open={isFormOpen || !!editingCustomer}
        onOpenChange={(open) => {
          if (!open) {
            setIsFormOpen(false);
            setEditingCustomer(null);
          }
        }}
        customer={editingCustomer}
        onSuccess={handleFormSuccess}
      />

      {/* Customer Detail Dialog */}
      <CustomerDetailDialog
        customer={selectedCustomer}
        sales={customerSales}
        isLoadingSales={isLoadingSales}
        categoryLabels={categoryLabels}
        categoryColors={categoryColors}
        onClose={() => setSelectedCustomer(null)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSaleRegister={handleSaleRegister}
      />

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>고객 삭제</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground text-sm">
              <span className="font-medium text-foreground">{deleteTarget?.name}</span> 고객을 삭제하시겠습니까?
            </p>
            <p className="text-muted-foreground text-xs mt-2">연결된 매출 기록은 유지됩니다.</p>
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
    </div>
  );
}

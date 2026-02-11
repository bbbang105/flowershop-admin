'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Users, Pencil, Trash2, Loader2, Phone, ShoppingBag, ExternalLink, TrendingUp, Crown, Star, AlertTriangle, UserPlus, CalendarDays } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { createCustomer, updateCustomer, deleteCustomer, getCustomerSales, checkPhoneDuplicate } from '@/lib/actions/customers';
import { cn, formatPhoneNumber, formatCurrency } from '@/lib/utils';
import type { Customer, Sale } from '@/types/database';
import { ExportButton } from '@/components/ui/export-button';
import type { ExportConfig } from '@/lib/export';
import type { SaleCategory } from '@/lib/actions/sale-settings';

const gradeLabels: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  new: { label: '신규', icon: '', color: 'text-muted-foreground', bg: 'bg-muted' },
  regular: { label: '단골', icon: '🌟', color: 'text-yellow-600', bg: 'bg-muted' },
  vip: { label: 'VIP', icon: '👑', color: 'text-purple-600', bg: 'bg-purple-50' },
  blacklist: { label: '블랙', icon: '⚠️', color: 'text-red-600', bg: 'bg-red-50' },
};

const genderLabels: Record<string, string> = { male: '남', female: '여' };

function GenderBadge({ gender, size = 'sm' }: { gender: string | null | undefined; size?: 'sm' | 'md' }) {
  if (!gender) return null;
  const base = size === 'md' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-0.5 text-[10px]';
  if (gender === 'male') {
    return <span className={`${base} font-medium rounded bg-blue-500/10 text-blue-600 shrink-0`} aria-label="남성">{genderLabels.male}</span>;
  }
  if (gender === 'female') {
    return <span className={`${base} font-medium rounded bg-pink-500/10 text-pink-600 shrink-0`} aria-label="여성">{genderLabels.female}</span>;
  }
  return null;
}

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
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [gradeFilter, setGradeFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noteValue, setNoteValue] = useState('');
  const [editNoteValue, setEditNoteValue] = useState('');
  const [customerSales, setCustomerSales] = useState<Sale[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');
  const [editPhoneValue, setEditPhoneValue] = useState('');
  const [phoneDuplicate, setPhoneDuplicate] = useState<{ name: string } | null>(null);
  const [editPhoneDuplicate, setEditPhoneDuplicate] = useState<{ name: string } | null>(null);
  const phoneCheckRef = useRef<NodeJS.Timeout | null>(null);
  const editPhoneCheckRef = useRef<NodeJS.Timeout | null>(null);

  // 카테고리/결제방식 라벨 맵 생성
  const categoryLabels = useMemo(() =>
    Object.fromEntries(initialCategories.map(c => [c.value, c.label])), [initialCategories]);
  const categoryColors = useMemo(() =>
    Object.fromEntries(initialCategories.map(c => [c.value, c.color])), [initialCategories]);

  // 연락처 중복 체크 (등록)
  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setPhoneValue(formatted);
    setPhoneDuplicate(null);

    if (phoneCheckRef.current) clearTimeout(phoneCheckRef.current);

    if (formatted.length >= 12) { // 010-0000-000 이상
      phoneCheckRef.current = setTimeout(async () => {
        const duplicate = await checkPhoneDuplicate(formatted);
        setPhoneDuplicate(duplicate);
      }, 300);
    }
  };

  // 연락처 중복 체크 (수정)
  const handleEditPhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setEditPhoneValue(formatted);
    setEditPhoneDuplicate(null);

    if (editPhoneCheckRef.current) clearTimeout(editPhoneCheckRef.current);

    if (formatted.length >= 12 && editingCustomer) {
      editPhoneCheckRef.current = setTimeout(async () => {
        const duplicate = await checkPhoneDuplicate(formatted, editingCustomer.id);
        setEditPhoneDuplicate(duplicate);
      }, 300);
    }
  };

  // 정렬 함수
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

  // 등급별 그룹핑 (등급 필터가 '전체'일 때만)
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

  const getExportConfig = useCallback((): ExportConfig => ({
    filename: `고객_${format(new Date(), 'yyyy-MM-dd')}`,
    title: '고객 목록',
    columns: [
      { header: '이름', accessor: (c) => String(c.name || '') },
      { header: '전화번호', accessor: (c) => String(c.phone || '') },
      { header: '등급', accessor: (c) => gradeLabels[c.grade as string]?.label || String(c.grade || '') },
      { header: '성별', accessor: (c) => {
        const g = c.gender as string | null | undefined;
        return g ? genderLabels[g] || '' : '';
      }},
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      await createCustomer(formData);
      setIsFormOpen(false);
      router.refresh();
      toast.success('고객이 등록되었습니다');
    } catch (error: unknown) {
      console.error('Failed to create customer:', error);
      const message = error instanceof Error ? error.message : '';
      if (message.includes('이미') || (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === '23505')) {
        toast.error('이미 등록된 연락처입니다');
      } else {
        toast.error('고객 등록에 실패했습니다');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      await updateCustomer(editingCustomer.id, formData);
      setEditingCustomer(null);
      setSelectedCustomer(null);
      router.refresh();
      toast.success('고객 정보가 수정되었습니다');
    } catch (error: unknown) {
      console.error('Failed to update customer:', error);
      const message = error instanceof Error ? error.message : '';
      if (message.includes('이미') || (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === '23505')) {
        toast.error('이미 등록된 연락처입니다');
      } else {
        toast.error('고객 수정에 실패했습니다');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditNoteValue(customer.note || '');
    setEditPhoneValue(formatPhoneNumber(customer.phone || ''));
    setEditPhoneDuplicate(null);
    setSelectedCustomer(null);
  };

  const handleDelete = async (customer: Customer) => {
    setDeleteTarget(customer);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteCustomer(deleteTarget.id);
      setDeleteTarget(null);
      setSelectedCustomer(null);
      router.refresh();
      toast.success('고객이 삭제되었습니다');
    } catch (error) {
      console.error('Failed to delete customer:', error);
      toast.error('고객 삭제에 실패했습니다');
    } finally {
      setIsDeleting(false);
    }
  };

  // 카드 렌더링 함수
  const renderCustomerCard = (customer: Customer) => {
    const grade = gradeLabels[customer.grade];
    return (
      <Card
        key={customer.id}
        className="group cursor-pointer hover:bg-muted/30 active:bg-muted active:scale-[0.99] transition-colors touch-manipulation"
        onClick={() => handleSelectCustomer(customer)}
      >
        <CardContent className="p-4">
          {/* Top: name + grade + gender + actions */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 bg-muted rounded-full flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-muted-foreground">
                  {customer.name.charAt(0)}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-foreground text-sm truncate">{customer.name}</span>
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${grade.bg} ${grade.color} shrink-0`}>
                    {grade.icon} {grade.label}
                  </span>
                  <GenderBadge gender={customer.gender} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{customer.phone}</p>
              </div>
            </div>
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={(e) => { e.stopPropagation(); handleEdit(customer); }}
                aria-label={`${customer.name} 수정`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); handleDelete(customer); }}
                aria-label={`${customer.name} 삭제`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
            <div>
              <p className="text-[10px] text-muted-foreground">구매</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">{customer.total_purchase_count}회</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">총액</p>
              <p className="text-sm font-semibold text-brand tabular-nums">{formatCurrency(customer.total_purchase_amount)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">최근</p>
              <p className="text-sm font-medium text-foreground tabular-nums">
                {customer.last_purchase_date ? format(new Date(customer.last_purchase_date), 'M/d', { locale: ko }) : '-'}
              </p>
            </div>
          </div>

          {/* Note preview */}
          {customer.note && (
            <p className="text-xs text-muted-foreground mt-2 truncate" title={customer.note}>
              {customer.note}
            </p>
          )}
        </CardContent>
      </Card>
    );
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
          <Button onClick={() => { setIsFormOpen(true); setNoteValue(''); setPhoneValue(''); setPhoneDuplicate(null); }}>
            <Plus className="w-4 h-4 mr-2" />
            고객 등록
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">전체 고객</p>
                <p className="text-xl font-bold text-foreground tabular-nums">{stats.total}명</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                <span className="text-lg">🌟</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">단골/VIP</p>
                <p className="text-xl font-bold text-foreground tabular-nums">{stats.regularVip}명</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">최근 30일</p>
                <p className="text-xl font-bold text-foreground tabular-nums">{stats.recentBuyers}명</p>
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
              <Button variant="outline" size="sm" onClick={() => { setIsFormOpen(true); setNoteValue(''); setPhoneValue(''); setPhoneDuplicate(null); }}>
                첫 고객 등록하기
              </Button>
            </div>
          )}
        </Card>
      ) : groupedByGrade ? (
        // 등급별 섹션 그룹핑
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
                  {customers.map(renderCustomerCard)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // 특정 등급 필터 → 플랫 그리드
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredCustomers.map(renderCustomerCard)}
        </div>
      )}


      {/* Create Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">고객 등록</DialogTitle>
            <p className="text-sm text-muted-foreground">고객 정보를 등록하면 매출 입력 시 자동으로 연결돼요.</p>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="space-y-5 pt-2">
            <div className="space-y-2">
              <Label>고객명 *</Label>
              <Input name="name" placeholder="홍길동" required className="bg-muted" autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label>연락처 *</Label>
              <Input
                name="phone"
                value={phoneValue}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="010-0000-0000"
                required
                inputMode="tel"
                autoComplete="tel"
                className={cn("bg-muted", phoneDuplicate && "border-red-500 focus-visible:ring-red-500")}
              />
              {phoneDuplicate && (
                <p className="text-xs text-destructive">
                  이미 등록된 연락처입니다 ({phoneDuplicate.name})
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">같은 연락처의 고객은 중복 등록할 수 없어요</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>등급</Label>
                <Select name="grade" defaultValue="new">
                  <SelectTrigger className="bg-muted">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">신규</SelectItem>
                    <SelectItem value="regular">단골</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                    <SelectItem value="blacklist">블랙리스트</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>성별</Label>
                <Select name="gender" defaultValue="none">
                  <SelectTrigger className="bg-muted">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">미지정</SelectItem>
                    <SelectItem value="male">남성</SelectItem>
                    <SelectItem value="female">여성</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>메모</Label>
                <span className={cn("text-xs", noteValue.length > 200 ? "text-destructive" : "text-muted-foreground")}>
                  {noteValue.length}/200
                </span>
              </div>
              <Textarea
                name="note"
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value.slice(0, 200))}
                placeholder="고객에 대한 메모를 입력하세요..."
                className="bg-muted min-h-[80px] resize-none"
                maxLength={200}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>취소</Button>
              <Button type="submit" disabled={isSubmitting || !!phoneDuplicate || phoneValue.length < 13}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isSubmitting ? '저장 중...' : '저장'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Customer Detail Dialog */}
      <Dialog open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">고객 상세</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-lg text-foreground">{selectedCustomer.name}</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${gradeLabels[selectedCustomer.grade].bg} ${gradeLabels[selectedCustomer.grade].color}`}>
                      {gradeLabels[selectedCustomer.grade].icon} {gradeLabels[selectedCustomer.grade].label}
                    </span>
                    <GenderBadge gender={selectedCustomer.gender} size="md" />
                  </div>
                  <a href={`tel:${selectedCustomer.phone.replace(/-/g, '')}`} className="flex items-center gap-1 text-muted-foreground text-sm hover:text-brand transition-colors">
                    <Phone className="w-3 h-3" />
                    <span>{selectedCustomer.phone}</span>
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">구매 횟수</p>
                  <p className="text-xl font-bold text-foreground tabular-nums">{selectedCustomer.total_purchase_count}회</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">총 구매액</p>
                  <p className="text-xl font-bold text-brand tabular-nums">{formatCurrency(selectedCustomer.total_purchase_amount)}</p>
                </div>
              </div>

              {selectedCustomer.first_purchase_date && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">첫 구매</p>
                    <p className="font-medium">{format(new Date(selectedCustomer.first_purchase_date), 'yyyy.M.d', { locale: ko })}</p>
                  </div>
                  {selectedCustomer.last_purchase_date && (
                    <div>
                      <p className="text-muted-foreground">최근 구매</p>
                      <p className="font-medium">{format(new Date(selectedCustomer.last_purchase_date), 'yyyy.M.d', { locale: ko })}</p>
                    </div>
                  )}
                </div>
              )}

              {selectedCustomer.note && (
                <div className="space-y-1 pt-2 border-t">
                  <p className="text-sm text-muted-foreground">메모</p>
                  <p className="text-foreground">{selectedCustomer.note}</p>
                </div>
              )}

              {/* 구매 이력 */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">구매 이력</p>
                </div>
                {isLoadingSales ? (
                  <div className="space-y-2 py-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex justify-between items-center p-2 bg-muted rounded">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-3.5 w-8" />
                          <Skeleton className="h-5 w-16 rounded" />
                        </div>
                        <Skeleton className="h-4 w-20" />
                      </div>
                    ))}
                  </div>
                ) : customerSales.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {customerSales.slice(0, 5).map((sale) => (
                      <div
                        key={sale.id}
                        className="flex justify-between items-center text-sm p-2 bg-muted rounded"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{format(new Date(sale.date), 'M/d', { locale: ko })}</span>
                          <span
                            className="px-1.5 py-0.5 text-xs font-medium rounded"
                            style={{
                              backgroundColor: categoryColors[sale.product_category] ? `${categoryColors[sale.product_category]}40` : '#f3f4f6',
                              color: categoryColors[sale.product_category] || '#374151'
                            }}
                          >
                            {categoryLabels[sale.product_category] || sale.product_category || sale.product_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(sale.amount)}</span>
                          <button
                            type="button"
                            className="text-brand hover:text-brand p-1"
                            onClick={() => {
                              const saleDate = new Date(sale.date);
                              const year = saleDate.getFullYear();
                              const month = saleDate.getMonth() + 1;
                              router.push(`/sales?year=${year}&month=${month}&saleId=${sale.id}`);
                            }}
                            title="매출 상세 보기"
                            aria-label="매출 상세 보기"
                          >
                            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {customerSales.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center">외 {customerSales.length - 5}건</p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 py-4 text-center">
                    <TrendingUp className="w-5 h-5 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">아직 구매 이력이 없습니다</p>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4 border-t">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const params = new URLSearchParams({
                        action: 'create',
                        customer_name: selectedCustomer.name,
                        customer_phone: selectedCustomer.phone,
                        customer_id: selectedCustomer.id,
                      });
                      router.push(`/sales?${params.toString()}`);
                      setSelectedCustomer(null);
                    }}
                  >
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    매출 등록
                  </Button>
                  <Button variant="outline" onClick={() => handleEdit(selectedCustomer)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    수정
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive hover:bg-red-50"
                    onClick={() => {
                      handleDelete(selectedCustomer);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    삭제
                  </Button>
                </div>
                <Button variant="outline" onClick={() => setSelectedCustomer(null)}>
                  닫기
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* Edit Dialog */}
      <Dialog open={!!editingCustomer} onOpenChange={(open) => !open && setEditingCustomer(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">고객 수정</DialogTitle>
          </DialogHeader>
          {editingCustomer && (
            <form onSubmit={(e) => { e.preventDefault(); handleUpdate(e); }} className="space-y-5 pt-2">
              <div className="space-y-2">
                <Label>고객명 *</Label>
                <Input name="name" defaultValue={editingCustomer.name} required className="bg-muted" autoComplete="name" />
              </div>
              <div className="space-y-2">
                <Label>연락처 *</Label>
                <Input
                  name="phone"
                  value={editPhoneValue}
                  onChange={(e) => handleEditPhoneChange(e.target.value)}
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  className={cn("bg-muted", editPhoneDuplicate && "border-red-500 focus-visible:ring-red-500")}
                />
                {editPhoneDuplicate && (
                  <p className="text-xs text-destructive">
                    이미 등록된 연락처입니다 ({editPhoneDuplicate.name})
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>등급</Label>
                  <Select name="grade" defaultValue={editingCustomer.grade}>
                    <SelectTrigger className="bg-muted">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">신규</SelectItem>
                      <SelectItem value="regular">단골</SelectItem>
                      <SelectItem value="vip">VIP</SelectItem>
                      <SelectItem value="blacklist">블랙리스트</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>성별</Label>
                  <Select name="gender" defaultValue={editingCustomer.gender || 'none'}>
                    <SelectTrigger className="bg-muted">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">미지정</SelectItem>
                      <SelectItem value="male">남성</SelectItem>
                      <SelectItem value="female">여성</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>메모</Label>
                  <span className={cn("text-xs", editNoteValue.length > 200 ? "text-destructive" : "text-muted-foreground")}>
                    {editNoteValue.length}/200
                  </span>
                </div>
                <Textarea
                  name="note"
                  value={editNoteValue}
                  onChange={(e) => setEditNoteValue(e.target.value.slice(0, 200))}
                  placeholder="고객에 대한 메모를 입력하세요..."
                  className="bg-muted min-h-[80px] resize-none"
                  maxLength={200}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setEditingCustomer(null)}>취소</Button>
                <Button type="submit" disabled={isSubmitting || !!editPhoneDuplicate || editPhoneValue.length < 13}>
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

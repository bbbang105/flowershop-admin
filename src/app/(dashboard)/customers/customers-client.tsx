'use client';

import { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Users, ChevronRight, Pencil, Trash2, Loader2, Phone, ShoppingBag, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { createCustomer, updateCustomer, deleteCustomer, getCustomerSales, checkPhoneDuplicate } from '@/lib/actions/customers';
import { cn, formatPhoneNumber } from '@/lib/utils';
import type { Customer, Sale } from '@/types/database';
import type { SaleCategory, PaymentMethod } from '@/lib/actions/sale-settings';

const gradeLabels: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  new: { label: '신규', icon: '', color: 'text-gray-600', bg: 'bg-gray-100' },
  regular: { label: '단골', icon: '🌟', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  vip: { label: 'VIP', icon: '👑', color: 'text-purple-600', bg: 'bg-purple-50' },
  blacklist: { label: '블랙', icon: '⚠️', color: 'text-red-600', bg: 'bg-red-50' },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount);
}

interface Props {
  initialCustomers: Customer[];
  initialCategories: SaleCategory[];
  initialPayments: PaymentMethod[];
}

export function CustomersClient({ initialCustomers, initialCategories, initialPayments }: Props) {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [gradeFilter, setGradeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noteValue, setNoteValue] = useState('');
  const [editNoteValue, setEditNoteValue] = useState('');
  const [customerSales, setCustomerSales] = useState<Sale[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
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
  const paymentLabels = useMemo(() => 
    Object.fromEntries(initialPayments.map(p => [p.value, p.label])), [initialPayments]);
  const paymentColors = useMemo(() => 
    Object.fromEntries(initialPayments.map(p => [p.value, p.color])), [initialPayments]);

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

  const filteredCustomers = useMemo(() => {
    return initialCustomers
      .filter(c => gradeFilter === 'all' || c.grade === gradeFilter)
      .filter(c => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.phone.includes(q);
      });
  }, [initialCustomers, gradeFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = initialCustomers.length;
    const regular = initialCustomers.filter(c => c.grade === 'regular' || c.grade === 'vip').length;
    return { total, regular };
  }, [initialCustomers]);


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
    } catch (error: any) {
      console.error('Failed to create customer:', error);
      if (error?.code === '23505') {
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
    } catch (error: any) {
      console.error('Failed to update customer:', error);
      if (error?.code === '23505') {
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
    try {
      await deleteCustomer(deleteTarget.id);
      setDeleteTarget(null);
      setSelectedCustomer(null);
      router.refresh();
      toast.success('고객이 삭제되었습니다');
    } catch (error) {
      console.error('Failed to delete customer:', error);
      toast.error('고객 삭제에 실패했습니다');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">고객 관리</h1>
          <p className="text-gray-500 mt-1">고객 정보와 구매 이력을 관리하세요</p>
        </div>
        <Button onClick={() => { setIsFormOpen(true); setNoteValue(''); setPhoneValue(''); setPhoneDuplicate(null); }} className="bg-rose-500 hover:bg-rose-600">
          <Plus className="w-4 h-4 mr-2" />
          고객 등록
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">전체 고객</p>
                <p className="text-xl font-bold text-gray-900">{stats.total}명</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center">
                <span className="text-lg">🌟</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">단골/VIP</p>
                <p className="text-xl font-bold text-gray-900">{stats.regular}명</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={gradeFilter} onValueChange={setGradeFilter}>
          <SelectTrigger className="w-[120px] bg-white border-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="new">신규</SelectItem>
            <SelectItem value="regular">단골</SelectItem>
            <SelectItem value="vip">VIP</SelectItem>
            <SelectItem value="blacklist">블랙리스트</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="이름/연락처 검색..." 
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
                <TableHead className="font-semibold text-gray-700 pl-6">고객명</TableHead>
                <TableHead className="font-semibold text-gray-700 hidden lg:table-cell">연락처</TableHead>
                <TableHead className="font-semibold text-gray-700 w-[100px]">등급</TableHead>
                <TableHead className="font-semibold text-gray-700 text-right w-[80px]">구매횟수</TableHead>
                <TableHead className="font-semibold text-gray-700 text-right">총구매액</TableHead>
                <TableHead className="w-[100px] text-right pr-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <Users className="w-6 h-6 text-gray-400" />
                      </div>
                      <p>등록된 고객이 없습니다</p>
                      <Button variant="outline" size="sm" onClick={() => { setIsFormOpen(true); setNoteValue(''); setPhoneValue(''); setPhoneDuplicate(null); }}>
                        첫 고객 등록하기
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => {
                  const grade = gradeLabels[customer.grade];
                  return (
                    <TableRow 
                      key={customer.id} 
                      className="cursor-pointer hover:bg-gray-50/50 transition-colors"
                      onClick={() => handleSelectCustomer(customer)}
                    >
                      <TableCell className="pl-6">
                        <span className="font-medium text-gray-900">{customer.name}</span>
                      </TableCell>
                      <TableCell className="text-gray-500 hidden lg:table-cell">{customer.phone}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs font-medium rounded-md ${grade.bg} ${grade.color}`}>
                          {grade.icon} {grade.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-gray-600">{customer.total_purchase_count}회</TableCell>
                      <TableCell className="text-right font-semibold text-gray-900">{formatCurrency(customer.total_purchase_amount)}</TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex gap-1 justify-end">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-blue-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(customer);
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
                              handleDelete(customer);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {filteredCustomers.length === 0 ? (
          <Card className="border-0 shadow-sm p-8 text-center">
            <div className="flex flex-col items-center gap-2 text-gray-500">
              <Users className="w-8 h-8 text-gray-400" />
              <p>등록된 고객이 없습니다</p>
            </div>
          </Card>
        ) : (
          filteredCustomers.map((customer) => {
            const grade = gradeLabels[customer.grade];
            return (
              <Card 
                key={customer.id}
                className="border-0 shadow-sm p-4 cursor-pointer hover:shadow-md active:bg-gray-50 transition-all"
                onClick={() => handleSelectCustomer(customer)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{customer.name}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${grade.bg} ${grade.color}`}>
                        {grade.icon} {grade.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>{customer.phone}</span>
                      <span>구매 {customer.total_purchase_count}회</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className="font-bold text-gray-900">{formatCurrency(customer.total_purchase_amount)}</span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>


      {/* Create Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">고객 등록</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="space-y-5 pt-2">
            <div className="space-y-2">
              <Label>고객명 *</Label>
              <Input name="name" placeholder="홍길동" required className="bg-gray-50" />
            </div>
            <div className="space-y-2">
              <Label>연락처 *</Label>
              <Input 
                name="phone" 
                value={phoneValue}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="010-0000-0000" 
                required 
                className={cn("bg-gray-50", phoneDuplicate && "border-red-500 focus-visible:ring-red-500")}
              />
              {phoneDuplicate && (
                <p className="text-xs text-red-500">
                  이미 등록된 연락처입니다 ({phoneDuplicate.name})
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>등급</Label>
              <Select name="grade" defaultValue="new">
                <SelectTrigger className="bg-gray-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">신규</SelectItem>
                  <SelectItem value="regular">🌟 단골</SelectItem>
                  <SelectItem value="vip">👑 VIP</SelectItem>
                  <SelectItem value="blacklist">⚠️ 블랙리스트</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>메모</Label>
                <span className={cn("text-xs", noteValue.length > 200 ? "text-red-500" : "text-gray-400")}>
                  {noteValue.length}/200
                </span>
              </div>
              <Textarea
                name="note"
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value.slice(0, 200))}
                placeholder="고객에 대한 메모를 입력하세요"
                className="bg-gray-50 min-h-[80px] resize-none"
                maxLength={200}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>취소</Button>
              <Button type="submit" disabled={isSubmitting || !!phoneDuplicate || phoneValue.length < 13} className="bg-rose-500 hover:bg-rose-600">
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
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-gray-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-gray-900">{selectedCustomer.name}</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${gradeLabels[selectedCustomer.grade].bg} ${gradeLabels[selectedCustomer.grade].color}`}>
                      {gradeLabels[selectedCustomer.grade].icon} {gradeLabels[selectedCustomer.grade].label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-500 text-sm">
                    <Phone className="w-3 h-3" />
                    <span>{selectedCustomer.phone}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-gray-500">구매횟수</p>
                  <p className="text-xl font-bold text-gray-900">{selectedCustomer.total_purchase_count}회</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">총구매액</p>
                  <p className="text-xl font-bold text-rose-600">{formatCurrency(selectedCustomer.total_purchase_amount)}</p>
                </div>
              </div>

              {selectedCustomer.first_purchase_date && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">첫 구매</p>
                    <p className="font-medium">{format(new Date(selectedCustomer.first_purchase_date), 'yyyy.M.d', { locale: ko })}</p>
                  </div>
                  {selectedCustomer.last_purchase_date && (
                    <div>
                      <p className="text-gray-500">최근 구매</p>
                      <p className="font-medium">{format(new Date(selectedCustomer.last_purchase_date), 'yyyy.M.d', { locale: ko })}</p>
                    </div>
                  )}
                </div>
              )}

              {selectedCustomer.note && (
                <div className="space-y-1 pt-2 border-t">
                  <p className="text-sm text-gray-500">메모</p>
                  <p className="text-gray-700">{selectedCustomer.note}</p>
                </div>
              )}

              {/* 구매 이력 */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-gray-500" />
                  <p className="text-sm font-medium text-gray-700">구매 이력</p>
                </div>
                {isLoadingSales ? (
                  <p className="text-sm text-gray-500 py-2">로딩 중...</p>
                ) : customerSales.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {customerSales.slice(0, 5).map((sale) => (
                      <div
                        key={sale.id}
                        className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">{format(new Date(sale.date), 'M/d', { locale: ko })}</span>
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
                            className="text-rose-500 hover:text-rose-600 p-1"
                            onClick={() => {
                              const saleDate = new Date(sale.date);
                              const year = saleDate.getFullYear();
                              const month = saleDate.getMonth() + 1;
                              router.push(`/sales?year=${year}&month=${month}&saleId=${sale.id}`);
                            }}
                            title="매출 상세 보기"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {customerSales.length > 5 && (
                      <p className="text-xs text-gray-400 text-center">외 {customerSales.length - 5}건</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-2">구매 이력이 없습니다</p>
                )}
              </div>

              <div className="flex justify-between pt-4 border-t">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleEdit(selectedCustomer)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    수정
                  </Button>
                  <Button 
                    variant="outline" 
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
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
                <Input name="name" defaultValue={editingCustomer.name} required className="bg-gray-50" />
              </div>
              <div className="space-y-2">
                <Label>연락처 *</Label>
                <Input 
                  name="phone" 
                  value={editPhoneValue}
                  onChange={(e) => handleEditPhoneChange(e.target.value)}
                  required 
                  className={cn("bg-gray-50", editPhoneDuplicate && "border-red-500 focus-visible:ring-red-500")}
                />
                {editPhoneDuplicate && (
                  <p className="text-xs text-red-500">
                    이미 등록된 연락처입니다 ({editPhoneDuplicate.name})
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>등급</Label>
                <Select name="grade" defaultValue={editingCustomer.grade}>
                  <SelectTrigger className="bg-gray-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">신규</SelectItem>
                    <SelectItem value="regular">🌟 단골</SelectItem>
                    <SelectItem value="vip">👑 VIP</SelectItem>
                    <SelectItem value="blacklist">⚠️ 블랙리스트</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>메모</Label>
                  <span className={cn("text-xs", editNoteValue.length > 200 ? "text-red-500" : "text-gray-400")}>
                    {editNoteValue.length}/200
                  </span>
                </div>
                <Textarea
                  name="note"
                  value={editNoteValue}
                  onChange={(e) => setEditNoteValue(e.target.value.slice(0, 200))}
                  placeholder="고객에 대한 메모를 입력하세요"
                  className="bg-gray-50 min-h-[80px] resize-none"
                  maxLength={200}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setEditingCustomer(null)}>취소</Button>
                <Button type="submit" disabled={isSubmitting || !!editPhoneDuplicate || editPhoneValue.length < 13} className="bg-rose-500 hover:bg-rose-600">
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
            <p className="text-gray-600 text-sm">
              <span className="font-medium text-gray-900">{deleteTarget?.name}</span> 고객을 삭제하시겠습니까?
            </p>
            <p className="text-gray-500 text-xs mt-2">연결된 매출 기록은 유지됩니다.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              취소
            </Button>
            <Button 
              className="bg-red-500 hover:bg-red-600"
              onClick={confirmDelete}
            >
              삭제
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

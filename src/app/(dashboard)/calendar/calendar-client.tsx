'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, X, Pencil, Trash2, Loader2, ShoppingBag, ExternalLink, BellRing } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import {
  getReservations,
  createReservation,
  updateReservation,
  deleteReservation,
  convertReservationToSale,
} from '@/lib/actions/reservations';
import { getSaleCategories, getPaymentMethods } from '@/lib/actions/sale-settings';
import type { Reservation, ReservationStatus } from '@/types/database';
import { RESERVATION_STATUS } from '@/types/database';
import type { SaleCategory, PaymentMethod } from '@/lib/actions/sale-settings';

function formatCurrency(amount: number): string {
  if (!amount) return '';
  return new Intl.NumberFormat('ko-KR').format(amount) + '원';
}

const channelLabels: Record<string, string> = {
  phone: '전화', kakaotalk: '카카오톡', naver_booking: '네이버예약', road: '로드', other: '기타',
};

const statusColors: Record<ReservationStatus, string> = {
  pending: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  confirmed: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  completed: 'bg-sage-muted text-sage border-sage/30',
  cancelled: 'bg-muted text-muted-foreground border-border',
};

const statusDotColors: Record<ReservationStatus, string> = {
  pending: 'bg-yellow-500',
  confirmed: 'bg-blue-500',
  completed: 'bg-sage',
  cancelled: 'bg-muted-foreground',
};

export function CalendarClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    customer_name: '',
    customer_phone: '',
    time: '',
    description: '',
    estimated_amount: '',
    status: 'pending' as ReservationStatus,
    reminder_date: '',
    reminder_time: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Reservation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sale conversion dialog
  const [saleTarget, setSaleTarget] = useState<Reservation | null>(null);
  const [saleCategories, setSaleCategories] = useState<SaleCategory[]>([]);
  const [salePaymentMethods, setSalePaymentMethods] = useState<PaymentMethod[]>([]);
  const [saleForm, setSaleForm] = useState({
    product_category: '',
    amount: '',
    payment_method: '',
    reservation_channel: 'other',
    note: '',
  });
  const [isSaleLoading, setIsSaleLoading] = useState(false);
  const [isSaleSubmitting, setIsSaleSubmitting] = useState(false);

  const monthStr = format(currentMonth, 'yyyy-MM');

  const fetchReservations = useCallback(async () => {
    setIsLoading(true);
    const result = await getReservations(monthStr);
    if (result.success && result.data) {
      setReservations(result.data);
    }
    setIsLoading(false);
  }, [monthStr]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // URL 파라미터로 매출 등록 모달 자동 오픈 (대시보드에서 연결)
  useEffect(() => {
    const action = searchParams.get('action');
    const reservationId = searchParams.get('reservationId');
    const dateParam = searchParams.get('date');

    if (action === 'sale' && reservationId && dateParam) {
      setSelectedDate(new Date(dateParam));
      setCurrentMonth(new Date(dateParam));
    }
  }, [searchParams]);

  // reservations 로드 후 URL 파라미터의 예약을 찾아 모달 오픈
  useEffect(() => {
    const reservationId = searchParams.get('reservationId');
    const action = searchParams.get('action');
    if (action === 'sale' && reservationId && reservations.length > 0) {
      const target = reservations.find(r => r.id === reservationId);
      if (target && !target.sale_id && target.status !== 'completed' && target.status !== 'cancelled') {
        openSaleModal(target);
        // URL 파라미터 정리
        router.replace('/calendar', { scroll: false });
      }
    }
  }, [reservations, searchParams, router]);

  // 매출 등록 모달 열기
  async function openSaleModal(reservation: Reservation) {
    setSaleTarget(reservation);
    setSaleForm({
      product_category: '',
      amount: reservation.estimated_amount ? String(reservation.estimated_amount) : '',
      payment_method: '',
      reservation_channel: 'other',
      note: '',
    });

    // 카테고리/결제방식 로드 (최초 1회만)
    if (saleCategories.length === 0) {
      setIsSaleLoading(true);
      try {
        const [cats, payments] = await Promise.all([
          getSaleCategories(),
          getPaymentMethods(),
        ]);
        setSaleCategories(cats);
        setSalePaymentMethods(payments);
      } catch {
        toast.error('매출 설정을 불러오지 못했습니다');
      } finally {
        setIsSaleLoading(false);
      }
    }
  }

  // 매출 등록 처리
  async function handleSaleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!saleTarget) return;

    if (!saleForm.product_category) {
      toast.error('상품 카테고리를 선택해주세요');
      return;
    }
    if (!saleForm.amount || parseInt(saleForm.amount) <= 0) {
      toast.error('금액을 입력해주세요');
      return;
    }
    if (!saleForm.payment_method) {
      toast.error('결제방식을 선택해주세요');
      return;
    }

    setIsSaleSubmitting(true);

    const formData = new FormData();
    formData.set('date', saleTarget.date);
    formData.set('product_category', saleForm.product_category);
    formData.set('amount', saleForm.amount);
    formData.set('payment_method', saleForm.payment_method);
    formData.set('reservation_channel', saleForm.reservation_channel);
    formData.set('note', saleForm.note || '');
    formData.set('deposit_status', saleForm.payment_method === 'card' ? 'pending' : 'not_applicable');

    if (saleTarget.customer_name) {
      formData.set('customer_name', saleTarget.customer_name);
    }
    if (saleTarget.customer_phone) {
      formData.set('customer_phone', saleTarget.customer_phone);
    }

    const result = await convertReservationToSale(saleTarget.id, formData);

    if (result.success) {
      toast.success('매출이 등록되고 예약이 완료 처리되었습니다');
      setSaleTarget(null);
      fetchReservations();
    } else {
      toast.error(result.error || '매출 등록에 실패했습니다');
    }

    setIsSaleSubmitting(false);
  }

  // Calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days: Date[] = [];
    let day = calStart;
    while (day <= calEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  // Group reservations by date
  const reservationsByDate = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of reservations) {
      const key = r.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [reservations]);

  // Reservations for selected date
  const selectedDateReservations = useMemo(() => {
    const key = format(selectedDate, 'yyyy-MM-dd');
    return reservationsByDate.get(key) || [];
  }, [selectedDate, reservationsByDate]);

  function resetForm() {
    setFormData({
      title: '',
      customer_name: '',
      customer_phone: '',
      time: '',
      description: '',
      estimated_amount: '',
      status: 'pending',
      reminder_date: '',
      reminder_time: '',
    });
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(reservation: Reservation) {
    setEditingId(reservation.id);
    setFormData({
      title: reservation.title,
      customer_name: reservation.customer_name,
      customer_phone: reservation.customer_phone || '',
      time: reservation.time?.slice(0, 5) || '',
      description: reservation.description || '',
      estimated_amount: reservation.estimated_amount ? String(reservation.estimated_amount) : '',
      status: reservation.status as ReservationStatus,
      reminder_date: reservation.reminder_at ? reservation.reminder_at.slice(0, 10) : '',
      reminder_time: reservation.reminder_at ? reservation.reminder_at.slice(11, 16) : '',
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('제목을 입력해주세요');
      return;
    }

    setIsSaving(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    // 리마인더 날짜+시간 → ISO 8601 (KST +09:00)
    let reminderAt: string | null = null;
    if (formData.reminder_date) {
      const time = formData.reminder_time || '08:00';
      reminderAt = `${formData.reminder_date}T${time}:00+09:00`;
    }

    if (editingId) {
      const result = await updateReservation(editingId, {
        date: dateStr,
        time: formData.time || null,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone || null,
        title: formData.title,
        description: formData.description || null,
        estimated_amount: formData.estimated_amount ? parseInt(formData.estimated_amount) : 0,
        status: formData.status,
        reminder_at: reminderAt,
      });
      if (result.success) {
        toast.success('예약이 수정되었습니다');
        resetForm();
        fetchReservations();
      } else {
        toast.error(result.error || '수정 실패');
      }
    } else {
      const result = await createReservation({
        date: dateStr,
        time: formData.time || undefined,
        customer_name: formData.customer_name,
        title: formData.title,
        description: formData.description || undefined,
        estimated_amount: formData.estimated_amount ? parseInt(formData.estimated_amount) : undefined,
        customer_phone: formData.customer_phone || undefined,
        status: formData.status,
        reminder_at: reminderAt,
      });
      if (result.success) {
        toast.success('예약이 등록되었습니다');
        resetForm();
        fetchReservations();
      } else {
        toast.error(result.error || '등록 실패');
      }
    }
    setIsSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const result = await deleteReservation(deleteTarget.id);
    if (result.success) {
      toast.success('예약이 삭제되었습니다');
      setDeleteTarget(null);
      fetchReservations();
    } else {
      toast.error(result.error || '삭제 실패');
    }
    setIsDeleting(false);
  }

  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">캘린더</h1>
          <p className="text-sm text-muted-foreground mt-1">날짜를 눌러서 예약을 추가하고, 상태를 관리할 수 있어요</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        {/* Calendar */}
        <Card className="lg:sticky lg:top-4">
          <CardContent className="p-4">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">
                {format(currentMonth, 'yyyy년 M월', { locale: ko })}
              </h2>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} aria-label="이전 달">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()); }}>
                  오늘
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} aria-label="다음 달">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Week day headers */}
            <div className="grid grid-cols-7">
              {weekDays.map((day, i) => (
                <div key={day} className={cn(
                  'text-center text-xs font-medium py-1.5',
                  i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-muted-foreground'
                )}>
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 border-t border-border">
              {calendarDays.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayReservations = reservationsByDate.get(dateKey) || [];
                const isSelected = isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isTodayDate = isToday(day);
                const dayOfWeek = day.getDay();

                return (
                  <button
                    key={dateKey}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      'relative aspect-square p-1 border-b border-r border-border text-left transition-colors hover:bg-muted/50 last:border-r-0 [&:nth-child(7n)]:border-r-0',
                      !isCurrentMonth && 'opacity-30',
                      isSelected && 'bg-brand-muted/50 hover:bg-brand-muted/50',
                    )}
                  >
                    <span className={cn(
                      'inline-flex items-center justify-center w-6 h-6 text-xs rounded-full',
                      isTodayDate && 'bg-brand text-brand-foreground font-semibold',
                      !isTodayDate && dayOfWeek === 0 && 'text-red-400',
                      !isTodayDate && dayOfWeek === 6 && 'text-blue-400',
                      !isTodayDate && isSelected && 'font-semibold text-foreground',
                    )}>
                      {format(day, 'd')}
                    </span>
                    {dayReservations.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5 flex-wrap">
                        {dayReservations.slice(0, 3).map((r) => (
                          <span
                            key={r.id}
                            className={cn('w-1.5 h-1.5 rounded-full', statusDotColors[r.status as ReservationStatus])}
                          />
                        ))}
                        {dayReservations.length > 3 && (
                          <span className="text-[10px] text-muted-foreground leading-none">+{dayReservations.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Status legend */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
              <span className="text-[11px] text-muted-foreground">상태:</span>
              {RESERVATION_STATUS.map((s) => (
                <div key={s.value} className="flex items-center gap-1">
                  <span className={cn('w-2 h-2 rounded-full', statusDotColors[s.value as ReservationStatus])} />
                  <span className="text-[11px] text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Side Panel */}
        <div className="space-y-3 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
          {/* Selected date header */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {format(selectedDate, 'M월 d일 (EEE)', { locale: ko })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedDateReservations.length > 0
                      ? `${selectedDateReservations.length}건의 예약`
                      : '예약 없음'}
                  </p>
                </div>
                <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  추가
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Form */}
          {showForm && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-foreground">{editingId ? '예약 수정' : '새 예약'}</p>
                  <Button variant="ghost" size="icon-sm" onClick={resetForm} aria-label="폼 닫기">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">제목</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="프로포즈 꽃다발"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">고객명</Label>
                      <Input
                        value={formData.customer_name}
                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                        placeholder="홍길동"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">시간</Label>
                      <Input
                        type="time"
                        value={formData.time}
                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">전화번호</Label>
                      <Input
                        value={formData.customer_phone}
                        onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                        placeholder="010-0000-0000"
                        className="h-8 text-sm"
                        inputMode="tel"
                        autoComplete="tel"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">예상 금액</Label>
                      <Input
                        type="number"
                        step={10000}
                        value={formData.estimated_amount}
                        onChange={(e) => setFormData({ ...formData, estimated_amount: e.target.value })}
                        placeholder="50000"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">상태</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as ReservationStatus })}>
                      <SelectTrigger className="h-8 text-sm w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RESERVATION_STATUS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">대기 → 확정 → 완료 순으로 변경해주세요</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      <BellRing className="w-3 h-3 inline mr-1" />
                      리마인더 알림
                    </Label>
                    <div className="grid grid-cols-[1fr_90px] gap-2">
                      <Input
                        type="date"
                        value={formData.reminder_date}
                        onChange={(e) => setFormData({ ...formData, reminder_date: e.target.value })}
                        className="h-8 text-sm"
                        aria-label="리마인더 알림 날짜"
                      />
                      <Input
                        type="time"
                        value={formData.reminder_time}
                        onChange={(e) => setFormData({ ...formData, reminder_time: e.target.value })}
                        className="h-8 text-sm"
                        aria-label="리마인더 알림 시간"
                        disabled={!formData.reminder_date}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {formData.reminder_date
                        ? `${formData.reminder_date} ${formData.reminder_time || '08:00'}에 푸시 알림`
                        : '날짜를 선택하면 해당 시간에 푸시 알림을 받아요 (기본 오전 8시)'}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">메모</Label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="메모를 입력하세요"
                      rows={2}
                      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring resize-none"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button type="button" variant="outline" size="sm" className="flex-1 h-9" onClick={resetForm}>
                      취소
                    </Button>
                    <Button type="submit" size="sm" className="flex-1 h-9" disabled={isSaving}>
                      {isSaving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                      {editingId ? '수정' : '등록'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Reservation list */}
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-10 rounded" />
                      <Skeleton className="h-4 w-10" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-3 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : selectedDateReservations.length > 0 ? (
            <div className="space-y-2">
              {selectedDateReservations.map((r) => (
                <Card key={r.id} className="group">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'text-[11px] px-1.5 py-0.5 rounded border font-medium',
                            statusColors[r.status as ReservationStatus]
                          )}>
                            {RESERVATION_STATUS.find(s => s.value === r.status)?.label}
                          </span>
                          {r.time && (
                            <span className="text-xs text-muted-foreground">{r.time.slice(0, 5)}</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground mt-1 truncate">{r.title}</p>
                        {r.customer_name && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {r.customer_name}
                            {r.customer_phone && ` · ${r.customer_phone}`}
                          </p>
                        )}
                        {r.estimated_amount > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(r.estimated_amount)}</p>
                        )}
                        {r.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
                        )}
                        {r.reminder_at && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <BellRing className="w-3 h-3" />
                            {r.reminder_at.slice(0, 10)} {r.reminder_at.slice(11, 16)} 알림
                          </p>
                        )}

                        {/* 매출 등록 버튼 또는 매출 확인 링크 */}
                        {r.status !== 'completed' && r.status !== 'cancelled' && !r.sale_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 w-full text-xs h-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              openSaleModal(r);
                            }}
                          >
                            <ShoppingBag className="h-3 w-3 mr-1" />
                            매출 등록
                          </Button>
                        )}
                        {r.sale_id && (
                          <button
                            className="mt-2 text-xs text-brand hover:text-brand/80 flex items-center gap-1 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/sales?saleId=${r.sale_id}`);
                            }}
                          >
                            매출 확인 <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button variant="ghost" size="icon-sm" onClick={() => startEdit(r)} aria-label="수정">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setDeleteTarget(r)} aria-label="삭제">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !showForm ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              이 날짜에 예약이 없습니다
            </div>
          ) : null}
        </div>
      </div>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>예약 삭제</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.title}&quot; 예약을 삭제하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>취소</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sale conversion dialog */}
      <Dialog open={!!saleTarget} onOpenChange={(open) => !open && setSaleTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>예약 → 매출 등록</DialogTitle>
            <DialogDescription>
              예약 정보를 기반으로 매출을 등록합니다. 등록 후 예약은 자동으로 완료 처리됩니다.
            </DialogDescription>
          </DialogHeader>
          {saleTarget && (
            <form onSubmit={(e) => { e.preventDefault(); handleSaleSubmit(e); }} className="space-y-4 pt-2">
              {/* 예약 정보 요약 */}
              <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                <p className="text-sm font-medium text-foreground">{saleTarget.title}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(saleTarget.date), 'yyyy년 M월 d일', { locale: ko })}
                  {saleTarget.time && ` ${saleTarget.time.slice(0, 5)}`}
                </p>
                {saleTarget.customer_name && (
                  <p className="text-xs text-muted-foreground">
                    {saleTarget.customer_name}
                    {saleTarget.customer_phone && ` · ${saleTarget.customer_phone}`}
                  </p>
                )}
              </div>

              {isSaleLoading ? (
                <div className="space-y-3 py-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-9 w-full rounded-md" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">상품 카테고리 *</Label>
                    <Select value={saleForm.product_category} onValueChange={(v) => setSaleForm({ ...saleForm, product_category: v })}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {saleCategories.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">금액 *</Label>
                    <Input
                      type="number"
                      value={saleForm.amount}
                      onChange={(e) => setSaleForm({ ...saleForm, amount: e.target.value })}
                      placeholder="50000"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">결제방식 *</Label>
                      <Select value={saleForm.payment_method} onValueChange={(v) => setSaleForm({ ...saleForm, payment_method: v })}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {salePaymentMethods.map((p) => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">예약 채널</Label>
                      <Select value={saleForm.reservation_channel} onValueChange={(v) => setSaleForm({ ...saleForm, reservation_channel: v })}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(channelLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">메모</Label>
                    <textarea
                      value={saleForm.note}
                      onChange={(e) => setSaleForm({ ...saleForm, note: e.target.value })}
                      placeholder="메모를 입력하세요"
                      rows={2}
                      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring resize-none"
                    />
                  </div>
                </>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSaleTarget(null)}>취소</Button>
                <Button type="submit" disabled={isSaleSubmitting || isSaleLoading}>
                  {isSaleSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  매출 등록
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use server';

import { createClient } from '@/lib/supabase/server';
import type { Sale, Reservation, PaymentMethod, ReservationChannel, ExpenseCategory } from '@/types/database';
import type {
  CategoryStat,
  PaymentMethodStat,
  ChannelStat,
  CustomerStat,
  ExpenseCategoryStat,
} from './statistics';
import { withErrorLogging } from '@/lib/errors';

export interface DashboardSummary {
  totalAmount: number;
  cardAmount: number;
  cashAmount: number;
  transferAmount: number;
  naverpayAmount: number;
  kakaopayAmount: number;
  pendingCount: number;
  pendingAmount: number;
}

async function _getTodaySummary(): Promise<DashboardSummary> {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: sales, error } = await supabase
    .from('sales')
    .select('amount, payment_method, deposit_status')
    .eq('date', today);

  if (error) throw error;

  const summary: DashboardSummary = {
    totalAmount: 0,
    cardAmount: 0,
    cashAmount: 0,
    transferAmount: 0,
    naverpayAmount: 0,
    kakaopayAmount: 0,
    pendingCount: 0,
    pendingAmount: 0,
  };

  (sales || []).forEach((sale) => {
    summary.totalAmount += sale.amount;

    switch (sale.payment_method) {
      case 'card':
        summary.cardAmount += sale.amount;
        break;
      case 'cash':
        summary.cashAmount += sale.amount;
        break;
      case 'transfer':
        summary.transferAmount += sale.amount;
        break;
      case 'naverpay':
        summary.naverpayAmount += sale.amount;
        break;
      case 'kakaopay':
        summary.kakaopayAmount += sale.amount;
        break;
    }

    if (sale.deposit_status === 'pending') {
      summary.pendingCount += 1;
      summary.pendingAmount += sale.amount;
    }
  });

  return summary;
}

export const getTodaySummary = withErrorLogging('getTodaySummary', _getTodaySummary);


async function _getRecentSales(limit: number = 10): Promise<Sale[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as Sale[];
}

export const getRecentSales = withErrorLogging('getRecentSales', _getRecentSales);

async function _getTodayReservations(): Promise<Reservation[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('date', today)
    .order('time', { nullsFirst: false });

  if (error) throw error;
  return (data || []) as Reservation[];
}

export const getTodayReservations = withErrorLogging('getTodayReservations', _getTodayReservations);

async function _getMonthExpenseTotal(month?: string): Promise<number> {
  const supabase = await createClient();

  let startDate: string;
  let endDate: string;

  if (month) {
    const [year, m] = month.split('-').map(Number);
    startDate = new Date(year, m - 1, 1).toISOString().split('T')[0];
    endDate = new Date(year, m, 0).toISOString().split('T')[0];
  } else {
    const now = new Date();
    startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  }

  const { data, error } = await supabase
    .from('expenses')
    .select('total_amount')
    .gte('date', startDate)
    .lte('date', endDate);

  if (error) throw error;
  return (data || []).reduce((sum, e) => sum + e.total_amount, 0);
}

export const getMonthExpenseTotal = withErrorLogging('getMonthExpenseTotal', _getMonthExpenseTotal);

async function _getMonthSummary(month?: string): Promise<DashboardSummary> {
  const supabase = await createClient();

  let startDate: string;
  let endDate: string;

  if (month) {
    const [year, m] = month.split('-').map(Number);
    startDate = new Date(year, m - 1, 1).toISOString().split('T')[0];
    endDate = new Date(year, m, 0).toISOString().split('T')[0];
  } else {
    const now = new Date();
    startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  }

  const { data: sales, error } = await supabase
    .from('sales')
    .select('amount, payment_method, deposit_status')
    .gte('date', startDate)
    .lte('date', endDate);

  if (error) throw error;

  return buildSummary(sales || []);
}

export const getMonthSummary = withErrorLogging('getMonthSummary', _getMonthSummary);

// --- 통합 액션 (대시보드 성능 최적화) ---

function buildSummary(sales: { amount: number; payment_method: string; deposit_status: string }[]): DashboardSummary {
  const summary: DashboardSummary = {
    totalAmount: 0, cardAmount: 0, cashAmount: 0,
    transferAmount: 0, naverpayAmount: 0, kakaopayAmount: 0,
    pendingCount: 0, pendingAmount: 0,
  };

  sales.forEach((sale) => {
    summary.totalAmount += sale.amount;
    switch (sale.payment_method) {
      case 'card': summary.cardAmount += sale.amount; break;
      case 'cash': summary.cashAmount += sale.amount; break;
      case 'transfer': summary.transferAmount += sale.amount; break;
      case 'naverpay': summary.naverpayAmount += sale.amount; break;
      case 'kakaopay': summary.kakaopayAmount += sale.amount; break;
    }
    if (sale.deposit_status === 'pending') {
      summary.pendingCount += 1;
      summary.pendingAmount += sale.amount;
    }
  });

  return summary;
}

function getMonthRange(month?: string): { startDate: string; endDate: string } {
  if (month) {
    const [year, m] = month.split('-').map(Number);
    return {
      startDate: new Date(year, m - 1, 1).toISOString().split('T')[0],
      endDate: new Date(year, m, 0).toISOString().split('T')[0],
    };
  }
  const now = new Date();
  return {
    startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
  };
}

export interface DashboardTodayData {
  summary: DashboardSummary;
  reservations: Reservation[];
  recentSales: Sale[];
  saleCategories: { value: string; label: string }[];
}

/** 오늘 대시보드 데이터를 단일 Server Action으로 조회 (4개 병렬 DB 쿼리) */
async function _getDashboardTodayData(): Promise<DashboardTodayData> {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  const [salesRes, reservationsRes, recentRes, categoriesRes] = await Promise.all([
    supabase.from('sales').select('amount, payment_method, deposit_status').eq('date', today),
    supabase.from('reservations').select('*').eq('date', today).order('time', { nullsFirst: false }),
    supabase.from('sales').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }).limit(5),
    supabase.from('sale_categories').select('value, label').order('sort_order', { ascending: true }),
  ]);

  if (salesRes.error) throw salesRes.error;
  if (reservationsRes.error) throw reservationsRes.error;
  if (recentRes.error) throw recentRes.error;
  if (categoriesRes.error) throw categoriesRes.error;

  return {
    summary: buildSummary(salesRes.data || []),
    reservations: (reservationsRes.data || []) as Reservation[],
    recentSales: (recentRes.data || []) as Sale[],
    saleCategories: categoriesRes.data || [],
  };
}

export const getDashboardTodayData = withErrorLogging('getDashboardTodayData', _getDashboardTodayData);

const PAYMENT_LABELS: Record<string, string> = {
  cash: '현금', card: '카드', transfer: '계좌이체', naverpay: '네이버페이', kakaopay: '카카오페이',
};
const CHANNEL_LABELS: Record<string, string> = {
  phone: '전화', kakaotalk: '카카오톡', naver_booking: '네이버예약', road: '로드', other: '기타',
};
const EXPENSE_LABELS: Record<string, string> = {
  flower_purchase: '꽃 사입', delivery: '배송비', advertising: '광고비',
  rent: '임대료', utilities: '공과금', supplies: '소모품', other: '기타',
};

export interface DashboardMonthData {
  summary: DashboardSummary;
  expenseTotal: number;
  categoryStats: CategoryStat[];
  paymentStats: PaymentMethodStat[];
  channelStats: ChannelStat[];
  customerStats: CustomerStat;
  expenseStats: ExpenseCategoryStat[];
}

/** 월별 대시보드 데이터를 단일 Server Action으로 조회 (2~3개 DB 쿼리) */
async function _getDashboardMonthData(month?: string): Promise<DashboardMonthData> {
  const supabase = await createClient();
  const { startDate, endDate } = getMonthRange(month);

  const [salesRes, expensesRes] = await Promise.all([
    supabase.from('sales')
      .select('amount, payment_method, deposit_status, product_category, reservation_channel, customer_phone')
      .gte('date', startDate).lte('date', endDate),
    supabase.from('expenses')
      .select('category, total_amount')
      .gte('date', startDate).lte('date', endDate),
  ]);

  if (salesRes.error) throw salesRes.error;
  if (expensesRes.error) throw expensesRes.error;

  const sales = salesRes.data || [];
  const expenses = expensesRes.data || [];

  const summary = buildSummary(sales);
  const expenseTotal = expenses.reduce((sum, e) => sum + e.total_amount, 0);

  // 카테고리별 매출
  const catMap = new Map<string, { count: number; amount: number }>();
  let catTotal = 0;
  sales.forEach((s) => {
    const cat = s.product_category || '기타';
    const ex = catMap.get(cat) || { count: 0, amount: 0 };
    ex.count += 1; ex.amount += s.amount;
    catMap.set(cat, ex); catTotal += s.amount;
  });
  const categoryStats: CategoryStat[] = Array.from(catMap.entries())
    .map(([name, st]) => ({ name, count: st.count, amount: st.amount, percentage: catTotal > 0 ? Math.round((st.amount / catTotal) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);

  // 결제방식별 매출
  const payMap = new Map<string, { count: number; amount: number }>();
  let payTotal = 0;
  sales.forEach((s) => {
    const pm = s.payment_method;
    const ex = payMap.get(pm) || { count: 0, amount: 0 };
    ex.count += 1; ex.amount += s.amount;
    payMap.set(pm, ex); payTotal += s.amount;
  });
  const paymentStats: PaymentMethodStat[] = Array.from(payMap.entries())
    .map(([method, st]) => ({ method: method as PaymentMethod, label: PAYMENT_LABELS[method] || method, count: st.count, amount: st.amount, percentage: payTotal > 0 ? Math.round((st.amount / payTotal) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);

  // 채널별 매출
  const chanMap = new Map<string, { count: number; amount: number }>();
  let chanTotal = 0;
  sales.forEach((s) => {
    const ch = s.reservation_channel || 'other';
    const ex = chanMap.get(ch) || { count: 0, amount: 0 };
    ex.count += 1; ex.amount += s.amount;
    chanMap.set(ch, ex); chanTotal += s.amount;
  });
  const channelStats: ChannelStat[] = Array.from(chanMap.entries())
    .map(([channel, st]) => ({ channel: channel as ReservationChannel, label: CHANNEL_LABELS[channel] || channel, count: st.count, amount: st.amount, percentage: chanTotal > 0 ? Math.round((st.amount / chanTotal) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);

  // 지출 카테고리별
  const expCatMap = new Map<string, number>();
  let expCatTotal = 0;
  expenses.forEach((e) => {
    expCatMap.set(e.category, (expCatMap.get(e.category) || 0) + e.total_amount);
    expCatTotal += e.total_amount;
  });
  const expenseStats: ExpenseCategoryStat[] = Array.from(expCatMap.entries())
    .map(([category, amount]) => ({ category: category as ExpenseCategory, label: EXPENSE_LABELS[category] || category, amount, percentage: expCatTotal > 0 ? Math.round((amount / expCatTotal) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);

  // 고객 통계 (N+1 제거: 단일 쿼리)
  const uniquePhones = [...new Set(
    sales.filter((s) => s.customer_phone).map((s) => s.customer_phone as string)
  )];
  const totalCustomers = uniquePhones.length;
  let returningCustomers = 0;

  if (totalCustomers > 0) {
    const { data: previousSales } = await supabase
      .from('sales')
      .select('customer_phone')
      .in('customer_phone', uniquePhones)
      .lt('date', startDate);

    returningCustomers = new Set(
      (previousSales || []).map((s) => s.customer_phone)
    ).size;
  }

  return {
    summary, expenseTotal, categoryStats, paymentStats, channelStats,
    customerStats: { totalCustomers, returningCustomers, newCustomers: totalCustomers - returningCustomers },
    expenseStats,
  };
}

export const getDashboardMonthData = withErrorLogging('getDashboardMonthData', _getDashboardMonthData);

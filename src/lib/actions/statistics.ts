'use server';

import { createClient } from '@/lib/supabase/server';
import type { PaymentMethod, ReservationChannel, ExpenseCategory } from '@/types/database';

export interface CategoryStat {
  name: string;
  count: number;
  amount: number;
  percentage: number;
}

export interface PaymentMethodStat {
  method: PaymentMethod;
  label: string;
  count: number;
  amount: number;
  percentage: number;
}

export interface ChannelStat {
  channel: ReservationChannel;
  label: string;
  count: number;
  amount: number;
  percentage: number;
}

export interface CustomerStat {
  newCustomers: number;
  returningCustomers: number;
  totalCustomers: number;
}

export interface ExpenseCategoryStat {
  category: ExpenseCategory;
  label: string;
  amount: number;
  percentage: number;
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: '현금',
  card: '카드',
  transfer: '계좌이체',
  naverpay: '네이버페이',
};

const CHANNEL_LABELS: Record<ReservationChannel, string> = {
  phone: '전화',
  kakaotalk: '카카오톡',
  naver_booking: '네이버예약',
  road: '로드',
  other: '기타',
};

const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  flower_purchase: '꽃 사입',
  delivery: '배송비',
  advertising: '광고비',
  rent: '임대료',
  utilities: '공과금',
  supplies: '소모품',
  other: '기타',
};


export async function getCategoryStats(month?: string): Promise<CategoryStat[]> {
  const supabase = await createClient();
  
  let query = supabase
    .from('sales')
    .select('product_category, amount');

  if (month) {
    const [year, m] = month.split('-').map(Number);
    const startDate = new Date(year, m - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, m, 0).toISOString().split('T')[0];
    query = query.gte('date', startDate).lte('date', endDate);
  }

  const { data, error } = await query;
  if (error) throw error;

  const categoryMap = new Map<string, { count: number; amount: number }>();
  let totalAmount = 0;

  (data || []).forEach((sale) => {
    const category = sale.product_category || '기타';
    const existing = categoryMap.get(category) || { count: 0, amount: 0 };
    existing.count += 1;
    existing.amount += sale.amount;
    categoryMap.set(category, existing);
    totalAmount += sale.amount;
  });

  return Array.from(categoryMap.entries())
    .map(([name, stats]) => ({
      name,
      count: stats.count,
      amount: stats.amount,
      percentage: totalAmount > 0 ? Math.round((stats.amount / totalAmount) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export async function getPaymentMethodStats(month?: string): Promise<PaymentMethodStat[]> {
  const supabase = await createClient();
  
  let query = supabase
    .from('sales')
    .select('payment_method, amount');

  if (month) {
    const [year, m] = month.split('-').map(Number);
    const startDate = new Date(year, m - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, m, 0).toISOString().split('T')[0];
    query = query.gte('date', startDate).lte('date', endDate);
  }

  const { data, error } = await query;
  if (error) throw error;

  const methodMap = new Map<PaymentMethod, { count: number; amount: number }>();
  let totalAmount = 0;

  (data || []).forEach((sale) => {
    const method = sale.payment_method as PaymentMethod;
    const existing = methodMap.get(method) || { count: 0, amount: 0 };
    existing.count += 1;
    existing.amount += sale.amount;
    methodMap.set(method, existing);
    totalAmount += sale.amount;
  });

  return Array.from(methodMap.entries())
    .map(([method, stats]) => ({
      method,
      label: PAYMENT_METHOD_LABELS[method],
      count: stats.count,
      amount: stats.amount,
      percentage: totalAmount > 0 ? Math.round((stats.amount / totalAmount) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}


export async function getChannelStats(month?: string): Promise<ChannelStat[]> {
  const supabase = await createClient();
  
  let query = supabase
    .from('sales')
    .select('reservation_channel, amount');

  if (month) {
    const [year, m] = month.split('-').map(Number);
    const startDate = new Date(year, m - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, m, 0).toISOString().split('T')[0];
    query = query.gte('date', startDate).lte('date', endDate);
  }

  const { data, error } = await query;
  if (error) throw error;

  const channelMap = new Map<ReservationChannel, { count: number; amount: number }>();
  let totalAmount = 0;

  (data || []).forEach((sale) => {
    const channel = (sale.reservation_channel || 'other') as ReservationChannel;
    const existing = channelMap.get(channel) || { count: 0, amount: 0 };
    existing.count += 1;
    existing.amount += sale.amount;
    channelMap.set(channel, existing);
    totalAmount += sale.amount;
  });

  return Array.from(channelMap.entries())
    .map(([channel, stats]) => ({
      channel,
      label: CHANNEL_LABELS[channel],
      count: stats.count,
      amount: stats.amount,
      percentage: totalAmount > 0 ? Math.round((stats.amount / totalAmount) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export async function getCustomerStats(month?: string): Promise<CustomerStat> {
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

  // 해당 월에 구매한 고객들의 연락처 가져오기
  const { data: monthSales, error: salesError } = await supabase
    .from('sales')
    .select('customer_phone, customer_id')
    .gte('date', startDate)
    .lte('date', endDate)
    .not('customer_phone', 'is', null);

  if (salesError) throw salesError;

  // 고유 고객 연락처 추출
  const uniquePhones = new Set<string>();
  (monthSales || []).forEach((sale) => {
    if (sale.customer_phone) {
      uniquePhones.add(sale.customer_phone);
    }
  });

  const totalCustomers = uniquePhones.size;

  if (totalCustomers === 0) {
    return { newCustomers: 0, returningCustomers: 0, totalCustomers: 0 };
  }

  // 단일 쿼리로 이전 구매 이력 확인 (N+1 제거)
  const { data: previousSales, error: prevError } = await supabase
    .from('sales')
    .select('customer_phone')
    .in('customer_phone', Array.from(uniquePhones))
    .lt('date', startDate);

  if (prevError) throw prevError;

  const returningPhones = new Set(
    (previousSales || []).map((s) => s.customer_phone)
  );
  const returningCustomers = returningPhones.size;

  return {
    newCustomers: totalCustomers - returningCustomers,
    returningCustomers,
    totalCustomers,
  };
}


export async function getExpenseCategoryStats(month?: string): Promise<ExpenseCategoryStat[]> {
  const supabase = await createClient();
  
  let query = supabase
    .from('expenses')
    .select('category, total_amount');

  if (month) {
    const [year, m] = month.split('-').map(Number);
    const startDate = new Date(year, m - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, m, 0).toISOString().split('T')[0];
    query = query.gte('date', startDate).lte('date', endDate);
  }

  const { data, error } = await query;
  if (error) throw error;

  const categoryMap = new Map<ExpenseCategory, number>();
  let totalAmount = 0;

  (data || []).forEach((expense) => {
    const category = expense.category as ExpenseCategory;
    const existing = categoryMap.get(category) || 0;
    categoryMap.set(category, existing + expense.total_amount);
    totalAmount += expense.total_amount;
  });

  return Array.from(categoryMap.entries())
    .map(([category, amount]) => ({
      category,
      label: EXPENSE_CATEGORY_LABELS[category],
      amount,
      percentage: totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export interface MonthlySalesTrend {
  month: string;
  label: string;
  totalAmount: number;
  salesCount: number;
}

export async function getMonthlySalesTrend(months: number = 6): Promise<MonthlySalesTrend[]> {
  const supabase = await createClient();
  const now = new Date();

  // 전체 기간을 단일 쿼리로 조회 (N+1 제거)
  const startMonth = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const startDate = startMonth.toISOString().split('T')[0];
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('sales')
    .select('date, amount')
    .gte('date', startDate)
    .lte('date', endDate);

  if (error) throw error;

  // JS에서 월별 그룹핑
  const monthMap = new Map<string, { amount: number; count: number }>();
  (data || []).forEach((sale) => {
    const [year, m] = sale.date.split('-');
    const monthKey = `${year}-${m}`;
    const existing = monthMap.get(monthKey) || { amount: 0, count: 0 };
    existing.amount += sale.amount;
    existing.count += 1;
    monthMap.set(monthKey, existing);
  });

  const trends: MonthlySalesTrend[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = `${date.getMonth() + 1}월`;
    const stats = monthMap.get(monthKey) || { amount: 0, count: 0 };
    trends.push({ month: monthKey, label, totalAmount: stats.amount, salesCount: stats.count });
  }

  return trends;
}

export interface DailySalesTrend {
  date: string;
  label: string;
  totalAmount: number;
  salesCount: number;
}

export async function getDailySalesTrend(month?: string): Promise<DailySalesTrend[]> {
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
    .from('sales')
    .select('date, amount')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');

  if (error) throw error;

  const dailyMap = new Map<string, { amount: number; count: number }>();

  (data || []).forEach((sale) => {
    const existing = dailyMap.get(sale.date) || { amount: 0, count: 0 };
    existing.amount += sale.amount;
    existing.count += 1;
    dailyMap.set(sale.date, existing);
  });

  return Array.from(dailyMap.entries())
    .map(([date, stats]) => ({
      date,
      label: new Date(date).getDate() + '일',
      totalAmount: stats.amount,
      salesCount: stats.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

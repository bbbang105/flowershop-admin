'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth-guard';
import type { Customer, CustomerGrade } from '@/types/database';
import { customerSchema, uuidSchema, searchQuerySchema, customerGradeSchema } from '@/lib/validations';
import { withErrorLogging, AppError, ErrorCode } from '@/lib/errors';

async function _getCustomers() {
  const supabase = await createClient();

  // 고객 + 매출 통계를 DB에서 집계 (RPC)
  const { data: statsData } = await supabase
    .rpc('get_customer_stats');

  // RPC 사용 가능하면 그대로, 아니면 fallback
  if (statsData) {
    const statsMap = new Map<string, { count: number; total: number; firstDate: string | null; lastDate: string | null }>();
    for (const row of statsData) {
      statsMap.set(row.customer_id, {
        count: row.purchase_count,
        total: row.purchase_total,
        firstDate: row.first_purchase,
        lastDate: row.last_purchase,
      });
    }

    const { data: customers, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!customers || customers.length === 0) return [];

    const customersWithStats = customers.map(customer => {
      const stats = statsMap.get(customer.id);
      return {
        ...customer,
        total_purchase_count: stats?.count || 0,
        total_purchase_amount: stats?.total || 0,
        first_purchase_date: stats?.firstDate || null,
        last_purchase_date: stats?.lastDate || null,
      };
    });

    customersWithStats.sort((a, b) => b.total_purchase_amount - a.total_purchase_amount);
    return customersWithStats as Customer[];
  }

  // Fallback: RPC 미사용 시 2-쿼리 방식 (메모리 집계 대신 DB group by 불가하므로 유지)
  const { data: customers, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!customers || customers.length === 0) return [];

  const customerIds = customers.map(c => c.id);
  const { data: salesStats } = await supabase
    .from('sales')
    .select('customer_id, amount, date')
    .in('customer_id', customerIds);

  const statsMap = new Map<string, { count: number; total: number; firstDate: string | null; lastDate: string | null }>();
  if (salesStats) {
    for (const sale of salesStats) {
      if (!sale.customer_id) continue;
      const existing = statsMap.get(sale.customer_id) || { count: 0, total: 0, firstDate: null, lastDate: null };
      existing.count += 1;
      existing.total += sale.amount;
      if (!existing.firstDate || sale.date < existing.firstDate) existing.firstDate = sale.date;
      if (!existing.lastDate || sale.date > existing.lastDate) existing.lastDate = sale.date;
      statsMap.set(sale.customer_id, existing);
    }
  }

  const customersWithStats = customers.map(customer => {
    const stats = statsMap.get(customer.id);
    return {
      ...customer,
      total_purchase_count: stats?.count || 0,
      total_purchase_amount: stats?.total || 0,
      first_purchase_date: stats?.firstDate || null,
      last_purchase_date: stats?.lastDate || null,
    };
  });

  customersWithStats.sort((a, b) => b.total_purchase_amount - a.total_purchase_amount);
  return customersWithStats as Customer[];
}

export const getCustomers = withErrorLogging('getCustomers', _getCustomers);

async function _getCustomerById(id: string) {
  const supabase = await createClient();

  // 고객 정보 + 매출 통계를 병렬로 조회
  const [customerResult, statsResult] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).single(),
    supabase
      .from('sales')
      .select('amount.sum(), amount.count(), date.min(), date.max()')
      .eq('customer_id', id)
      .single(),
  ]);

  if (customerResult.error) throw customerResult.error;

  // Supabase aggregate가 지원되지 않을 수 있으므로 fallback
  const statsData = statsResult.data as Record<string, unknown> | null;
  let count = 0, total = 0, firstDate: string | null = null, lastDate: string | null = null;

  if (statsData && typeof statsData.count === 'number') {
    count = statsData.count;
    total = (statsData.sum as number) || 0;
    firstDate = (statsData.min as string) || null;
    lastDate = (statsData.max as string) || null;
  } else {
    // Fallback: 개별 행 조회 후 집계
    const { data: sales } = await supabase
      .from('sales')
      .select('amount, date')
      .eq('customer_id', id);

    if (sales && sales.length > 0) {
      for (const sale of sales) {
        count += 1;
        total += sale.amount;
        if (!firstDate || sale.date < firstDate) firstDate = sale.date;
        if (!lastDate || sale.date > lastDate) lastDate = sale.date;
      }
    }
  }

  return {
    ...customerResult.data,
    total_purchase_count: count,
    total_purchase_amount: total,
    first_purchase_date: firstDate,
    last_purchase_date: lastDate,
  } as Customer;
}

export const getCustomerById = withErrorLogging('getCustomerById', _getCustomerById);

async function _createCustomer(formData: FormData) {
  await requireAuth();
  const supabase = await createClient();

  const parsed = customerSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
    grade: formData.get('grade') || 'new',
    note: formData.get('note') || null,
  });
  if (!parsed.success) {
    throw new AppError(ErrorCode.VALIDATION, `입력값이 올바르지 않습니다: ${parsed.error.issues[0]?.message}`);
  }

  const customer = {
    name: parsed.data.name,
    phone: parsed.data.phone,
    grade: parsed.data.grade || 'new',
    note: parsed.data.note || null,
  };

  const { data, error } = await supabase.from('customers').insert(customer).select().single();
  if (error) throw error;
  
  revalidatePath('/customers');
  return data;
}

export const createCustomer = withErrorLogging('createCustomer', _createCustomer);

async function _updateCustomer(id: string, formData: FormData) {
  await requireAuth();

  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) throw new AppError(ErrorCode.VALIDATION, '올바르지 않은 ID입니다');

  const parsed = customerSchema.partial().safeParse({
    name: formData.get('name') || undefined,
    phone: formData.get('phone') || undefined,
    grade: formData.get('grade') || undefined,
    note: formData.get('note') || null,
  });
  if (!parsed.success) {
    throw new AppError(ErrorCode.VALIDATION, `입력값이 올바르지 않습니다: ${parsed.error.issues[0]?.message}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from('customers').update(parsed.data).eq('id', id);
  if (error) throw error;

  revalidatePath('/customers');
  revalidatePath(`/customers/${id}`);
}

export const updateCustomer = withErrorLogging('updateCustomer', _updateCustomer);

async function _updateCustomerGrade(id: string, grade: CustomerGrade) {
  await requireAuth();

  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) throw new AppError(ErrorCode.VALIDATION, '올바르지 않은 ID입니다');
  const gradeParsed = customerGradeSchema.safeParse(grade);
  if (!gradeParsed.success) throw new AppError(ErrorCode.VALIDATION, '올바르지 않은 등급입니다');

  const supabase = await createClient();
  const { error } = await supabase.from('customers').update({ grade: gradeParsed.data }).eq('id', id);
  if (error) throw error;
  
  revalidatePath('/customers');
  revalidatePath(`/customers/${id}`);
}

export const updateCustomerGrade = withErrorLogging('updateCustomerGrade', _updateCustomerGrade);

async function _deleteCustomer(id: string) {
  await requireAuth();
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) throw new AppError(ErrorCode.VALIDATION, '올바르지 않은 ID입니다');
  const supabase = await createClient();
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) throw error;

  revalidatePath('/customers');
}

export const deleteCustomer = withErrorLogging('deleteCustomer', _deleteCustomer);

async function _findOrCreateCustomer(name: string, phone: string) {
  const supabase = await createClient();

  // upsert로 레이스 컨디션 방지 (phone이 unique 제약)
  const { data, error } = await supabase
    .from('customers')
    .upsert(
      { name, phone, grade: 'new' },
      { onConflict: 'phone', ignoreDuplicates: true }
    )
    .select()
    .single();

  if (error) {
    // upsert 후에도 에러면 기존 고객 조회 시도
    const { data: existing } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', phone)
      .single();
    if (existing) return existing as Customer;
    throw error;
  }

  return data as Customer;
}

export const findOrCreateCustomer = withErrorLogging('findOrCreateCustomer', _findOrCreateCustomer);

async function _getCustomerSales(customerId: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('customer_id', customerId)
    .order('date', { ascending: false });
  
  if (error) throw error;
  return data;
}

export const getCustomerSales = withErrorLogging('getCustomerSales', _getCustomerSales);

// 이름으로 고객 검색 (LIKE)
async function _searchCustomersByName(query: string) {
  if (!query || query.length < 1) return [];

  const supabase = await createClient();

  // PostgREST 와일드카드 이스케이프 (%, _, \)
  const escaped = query.replace(/[%_\\]/g, (ch) => `\\${ch}`);

  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone, grade')
    .ilike('name', `%${escaped}%`)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data as Pick<Customer, 'id' | 'name' | 'phone' | 'grade'>[];
}

export const searchCustomersByName = withErrorLogging('searchCustomersByName', _searchCustomersByName);

// 연락처 중복 체크
async function _checkPhoneDuplicate(phone: string, excludeId?: string) {
  if (!phone || phone.length < 10) return null;

  const supabase = await createClient();

  // 하이픈 제거해서 비교
  const cleanPhone = phone.replace(/[^0-9]/g, '');

  // 포맷된 전화번호로 먼저 조회
  let query = supabase
    .from('customers')
    .select('id, name, phone')
    .eq('phone', phone);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data } = await query.limit(1).maybeSingle();
  if (data) return data as { id: string; name: string; phone: string };

  // 하이픈 없는 번호로 재조회
  if (cleanPhone !== phone) {
    let query2 = supabase
      .from('customers')
      .select('id, name, phone')
      .eq('phone', cleanPhone);

    if (excludeId) {
      query2 = query2.neq('id', excludeId);
    }

    const { data: data2 } = await query2.limit(1).maybeSingle();
    if (data2) return data2 as { id: string; name: string; phone: string };
  }

  return null;
}

export const checkPhoneDuplicate = withErrorLogging('checkPhoneDuplicate', _checkPhoneDuplicate);

// 고객 생성 또는 기존 고객 반환 (이름+전화번호로)
async function _getOrCreateCustomer(name: string, phone?: string): Promise<Customer | null> {
  if (!name) return null;

  const supabase = await createClient();

  // 전화번호가 있으면 upsert로 원자적 처리
  if (phone) {
    return _findOrCreateCustomer(name, phone);
  }

  // 전화번호 없이는 고객 생성 불가 (phone이 unique 필수 필드)
  return null;
}

export const getOrCreateCustomer = withErrorLogging('getOrCreateCustomer', _getOrCreateCustomer);

'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Customer, CustomerGrade } from '@/types/database';

export async function getCustomers() {
  const supabase = await createClient();
  
  // 고객 기본 정보 조회
  const { data: customers, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  if (!customers || customers.length === 0) return [];
  
  // 모든 매출에서 고객별 집계 (실시간 계산)
  const { data: salesStats } = await supabase
    .from('sales')
    .select('customer_id, amount, date')
    .not('customer_id', 'is', null);
  
  // 고객별 통계 계산
  const statsMap = new Map<string, { count: number; total: number; firstDate: string | null; lastDate: string | null }>();
  
  if (salesStats) {
    for (const sale of salesStats) {
      if (!sale.customer_id) continue;
      
      const existing = statsMap.get(sale.customer_id) || { count: 0, total: 0, firstDate: null, lastDate: null };
      existing.count += 1;
      existing.total += sale.amount;
      
      if (!existing.firstDate || sale.date < existing.firstDate) {
        existing.firstDate = sale.date;
      }
      if (!existing.lastDate || sale.date > existing.lastDate) {
        existing.lastDate = sale.date;
      }
      
      statsMap.set(sale.customer_id, existing);
    }
  }
  
  // 고객 데이터에 실시간 통계 병합
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
  
  // 총구매액 기준 정렬
  customersWithStats.sort((a, b) => b.total_purchase_amount - a.total_purchase_amount);
  
  return customersWithStats as Customer[];
}

export async function getCustomerById(id: string) {
  const supabase = await createClient();
  
  const { data: customer, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  
  // 해당 고객의 매출 통계 실시간 계산
  const { data: sales } = await supabase
    .from('sales')
    .select('amount, date')
    .eq('customer_id', id);
  
  let stats = { count: 0, total: 0, firstDate: null as string | null, lastDate: null as string | null };
  
  if (sales && sales.length > 0) {
    for (const sale of sales) {
      stats.count += 1;
      stats.total += sale.amount;
      
      if (!stats.firstDate || sale.date < stats.firstDate) {
        stats.firstDate = sale.date;
      }
      if (!stats.lastDate || sale.date > stats.lastDate) {
        stats.lastDate = sale.date;
      }
    }
  }
  
  return {
    ...customer,
    total_purchase_count: stats.count,
    total_purchase_amount: stats.total,
    first_purchase_date: stats.firstDate,
    last_purchase_date: stats.lastDate,
  } as Customer;
}

export async function createCustomer(formData: FormData) {
  const supabase = await createClient();
  
  const customer = {
    name: formData.get('name') as string,
    phone: formData.get('phone') as string,
    grade: (formData.get('grade') as CustomerGrade) || 'new',
    note: formData.get('note') as string || null,
  };
  
  const { data, error } = await supabase.from('customers').insert(customer).select().single();
  if (error) throw error;
  
  revalidatePath('/customers');
  return data;
}

export async function updateCustomer(id: string, formData: FormData) {
  const supabase = await createClient();
  
  const updates: Record<string, any> = {};
  const fields = ['name', 'phone', 'grade', 'note'];
  
  fields.forEach(field => {
    const value = formData.get(field);
    if (value !== null) {
      updates[field] = value || null;
    }
  });
  
  const { error } = await supabase.from('customers').update(updates).eq('id', id);
  if (error) throw error;
  
  revalidatePath('/customers');
  revalidatePath(`/customers/${id}`);
}

export async function updateCustomerGrade(id: string, grade: CustomerGrade) {
  const supabase = await createClient();
  
  const { error } = await supabase.from('customers').update({ grade }).eq('id', id);
  if (error) throw error;
  
  revalidatePath('/customers');
  revalidatePath(`/customers/${id}`);
}

export async function deleteCustomer(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) throw error;
  
  revalidatePath('/customers');
}

export async function findOrCreateCustomer(name: string, phone: string) {
  const supabase = await createClient();
  
  // 기존 고객 찾기
  const { data: existing } = await supabase
    .from('customers')
    .select('*')
    .eq('phone', phone)
    .single();
  
  if (existing) return existing as Customer;
  
  // 새 고객 생성
  const { data, error } = await supabase
    .from('customers')
    .insert({ name, phone, grade: 'new' })
    .select()
    .single();
  
  if (error) throw error;
  return data as Customer;
}

export async function getCustomerSales(customerId: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('customer_id', customerId)
    .order('date', { ascending: false });
  
  if (error) throw error;
  return data;
}

// 이름으로 고객 검색 (LIKE)
export async function searchCustomersByName(query: string) {
  if (!query || query.length < 1) return [];
  
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone, grade')
    .ilike('name', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) throw error;
  return data as Pick<Customer, 'id' | 'name' | 'phone' | 'grade'>[];
}

// 연락처 중복 체크
export async function checkPhoneDuplicate(phone: string, excludeId?: string) {
  if (!phone || phone.length < 10) return null;
  
  const supabase = await createClient();
  
  // 하이픈 제거해서 비교
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  
  let query = supabase
    .from('customers')
    .select('id, name, phone')
    .or(`phone.eq.${phone},phone.eq.${cleanPhone}`);
  
  // 수정 시 자기 자신 제외
  if (excludeId) {
    query = query.neq('id', excludeId);
  }
  
  const { data } = await query.limit(1).single();
  
  return data as { id: string; name: string; phone: string } | null;
}

// 고객 생성 또는 기존 고객 반환 (이름+전화번호로)
export async function getOrCreateCustomer(name: string, phone?: string): Promise<Customer | null> {
  if (!name) return null;
  
  const supabase = await createClient();
  
  // 전화번호가 있으면 전화번호로 먼저 찾기
  if (phone) {
    const { data: existingByPhone } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', phone)
      .single();
    
    if (existingByPhone) return existingByPhone as Customer;
  }
  
  // 새 고객 생성 (전화번호 없으면 임시 생성)
  const customerPhone = phone || `temp-${Date.now()}`;
  
  const { data, error } = await supabase
    .from('customers')
    .insert({ 
      name, 
      phone: customerPhone, 
      grade: 'new',
      total_purchase_count: 0,
      total_purchase_amount: 0
    })
    .select()
    .single();
  
  if (error) {
    // 전화번호 중복 에러면 무시하고 null 반환
    if (error.code === '23505') return null;
    throw error;
  }
  
  return data as Customer;
}

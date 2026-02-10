'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth-guard';

export interface ExpenseCategory {
  id: string;
  value: string;
  label: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface ExpensePaymentMethod {
  id: string;
  value: string;
  label: string;
  color: string;
  sort_order: number;
  created_at: string;
}

// 기본 카테고리 (DB에 없을 경우 사용)
const DEFAULT_CATEGORIES: Omit<ExpenseCategory, 'id' | 'created_at'>[] = [
  { value: 'flower_purchase', label: '꽃 사입', color: '#ec4899', sort_order: 1 },
  { value: 'delivery', label: '배송비', color: '#3b82f6', sort_order: 2 },
  { value: 'advertising', label: '광고비', color: '#a855f7', sort_order: 3 },
  { value: 'rent', label: '임대료', color: '#f97316', sort_order: 4 },
  { value: 'utilities', label: '공과금', color: '#06b6d4', sort_order: 5 },
  { value: 'supplies', label: '소모품', color: '#6b7280', sort_order: 6 },
  { value: 'other', label: '기타', color: '#9ca3af', sort_order: 7 },
];

const DEFAULT_PAYMENTS: Omit<ExpensePaymentMethod, 'id' | 'created_at'>[] = [
  { value: 'card', label: '카드', color: '#3b82f6', sort_order: 1 },
  { value: 'cash', label: '현금', color: '#f97316', sort_order: 2 },
  { value: 'transfer', label: '계좌이체', color: '#a855f7', sort_order: 3 },
];

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .order('sort_order', { ascending: true });
  
  if (error || !data || data.length === 0) {
    // 테이블이 없거나 데이터가 없으면 기본값 반환
    return DEFAULT_CATEGORIES.map((cat, idx) => ({
      ...cat,
      id: `default-${idx}`,
      created_at: new Date().toISOString(),
    }));
  }
  return data;
}

export async function getExpensePaymentMethods(): Promise<ExpensePaymentMethod[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('expense_payment_methods')
    .select('*')
    .order('sort_order', { ascending: true });
  
  if (error || !data || data.length === 0) {
    return DEFAULT_PAYMENTS.map((pm, idx) => ({
      ...pm,
      id: `default-${idx}`,
      created_at: new Date().toISOString(),
    }));
  }
  return data;
}


export async function createExpenseCategory(label: string, color: string): Promise<ExpenseCategory> {
  await requireAuth();
  const supabase = await createClient();
  
  // value 생성 (label을 snake_case로 변환)
  const value = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_가-힣]/g, '');
  
  // 최대 sort_order 조회
  const { data: existing } = await supabase
    .from('expense_categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);
  
  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 1;
  
  const { data, error } = await supabase
    .from('expense_categories')
    .insert({ value, label, color, sort_order: nextOrder })
    .select()
    .single();
  
  if (error) throw new Error('카테고리 추가에 실패했습니다');
  
  revalidatePath('/expenses');
  return data;
}

export async function updateExpenseCategory(id: string, label: string, color: string): Promise<void> {
  await requireAuth();
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('expense_categories')
    .update({ label, color })
    .eq('id', id);
  
  if (error) throw new Error('카테고리 수정에 실패했습니다');
  
  revalidatePath('/expenses');
}

export async function deleteExpenseCategory(id: string): Promise<void> {
  await requireAuth();
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('expense_categories')
    .delete()
    .eq('id', id);
  
  if (error) throw new Error('카테고리 삭제에 실패했습니다');
  
  revalidatePath('/expenses');
}

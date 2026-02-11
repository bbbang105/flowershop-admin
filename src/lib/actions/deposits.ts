'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth-guard';
import type { Sale, DepositStatus } from '@/types/database';
import { idsSchema, uuidSchema } from '@/lib/validations';

export interface DepositsFilter {
  month?: string;
  status?: DepositStatus | 'all';
  cardCompany?: string;
}

export async function getDeposits(filter: DepositsFilter = {}): Promise<Sale[]> {
  const supabase = await createClient();
  
  let query = supabase
    .from('sales')
    .select('*')
    .in('payment_method', ['card'])
    .order('date', { ascending: false });

  // 월 필터
  if (filter.month) {
    const [year, m] = filter.month.split('-').map(Number);
    const startDate = new Date(year, m - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, m, 0).toISOString().split('T')[0];
    query = query.gte('date', startDate).lte('date', endDate);
  }

  // 입금 상태 필터
  if (filter.status && filter.status !== 'all') {
    query = query.eq('deposit_status', filter.status);
  }

  // 카드사 필터
  if (filter.cardCompany && filter.cardCompany !== 'all') {
    query = query.eq('card_company', filter.cardCompany);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Sale[];
}

export async function getPendingDeposits(month?: string): Promise<Sale[]> {
  return getDeposits({ month, status: 'pending' });
}

export async function getCompletedDeposits(month?: string): Promise<Sale[]> {
  return getDeposits({ month, status: 'completed' });
}


export async function confirmDeposit(id: string): Promise<void> {
  await requireAuth();
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) throw new Error('올바르지 않은 ID입니다');
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('sales')
    .update({ 
      deposit_status: 'completed', 
      deposited_at: new Date().toISOString() 
    })
    .eq('id', id);

  if (error) throw error;
  
  revalidatePath('/deposits');
  revalidatePath('/');
}

export async function confirmMultipleDeposits(ids: string[]): Promise<void> {
  await requireAuth();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) throw new Error('올바르지 않은 ID 목록입니다');
  const supabase = await createClient();

  const { error } = await supabase
    .from('sales')
    .update({ 
      deposit_status: 'completed', 
      deposited_at: new Date().toISOString() 
    })
    .in('id', ids);

  if (error) throw error;
  
  revalidatePath('/deposits');
  revalidatePath('/');
}

export async function revertDeposit(id: string): Promise<void> {
  await requireAuth();
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) throw new Error('올바르지 않은 ID입니다');
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('sales')
    .update({ 
      deposit_status: 'pending', 
      deposited_at: null 
    })
    .eq('id', id);

  if (error) throw error;
  
  revalidatePath('/deposits');
  revalidatePath('/');
}

export interface DepositsSummary {
  pendingCount: number;
  pendingAmount: number;
  completedCount: number;
  completedAmount: number;
}

export async function getDepositsSummary(month?: string): Promise<DepositsSummary> {
  const supabase = await createClient();
  
  let query = supabase
    .from('sales')
    .select('amount, deposit_status, expected_deposit')
    .eq('payment_method', 'card');

  if (month) {
    const [year, m] = month.split('-').map(Number);
    const startDate = new Date(year, m - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, m, 0).toISOString().split('T')[0];
    query = query.gte('date', startDate).lte('date', endDate);
  }

  const { data, error } = await query;
  if (error) throw error;

  const summary: DepositsSummary = {
    pendingCount: 0,
    pendingAmount: 0,
    completedCount: 0,
    completedAmount: 0,
  };

  (data || []).forEach((sale) => {
    const depositAmount = sale.expected_deposit || sale.amount;
    if (sale.deposit_status === 'pending') {
      summary.pendingCount += 1;
      summary.pendingAmount += depositAmount;
    } else if (sale.deposit_status === 'completed') {
      summary.completedCount += 1;
      summary.completedAmount += depositAmount;
    }
  });

  return summary;
}

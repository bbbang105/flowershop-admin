'use server';

import { createClient } from '@/lib/supabase/server';
import type { Sale } from '@/types/database';

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

export async function getTodaySummary(): Promise<DashboardSummary> {
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


export async function getRecentSales(limit: number = 10): Promise<Sale[]> {
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

export async function getMonthSummary(month?: string): Promise<DashboardSummary> {
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

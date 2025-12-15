'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Expense } from '@/types/database';

export async function getExpenses(month?: string) {
  const supabase = await createClient();
  
  let query = supabase
    .from('expenses')
    .select('*')
    .order('date', { ascending: false });
  
  if (month) {
    const [year, m] = month.split('-').map(Number);
    const startDate = new Date(year, m - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, m, 0).toISOString().split('T')[0];
    query = query.gte('date', startDate).lte('date', endDate);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data as Expense[];
}

export async function createExpense(formData: FormData) {
  const supabase = await createClient();
  
  const unitPrice = parseInt(formData.get('unit_price') as string);
  const quantity = parseInt(formData.get('quantity') as string) || 1;
  
  const expense = {
    date: formData.get('date') as string,
    item_name: formData.get('item_name') as string,
    category: formData.get('category') as string,
    unit_price: unitPrice,
    quantity: quantity,
    total_amount: unitPrice * quantity,
    payment_method: formData.get('payment_method') as string,
    card_company: formData.get('card_company') as string || null,
    vendor: formData.get('vendor') as string || null,
    note: formData.get('note') as string || null,
  };
  
  const { data, error } = await supabase.from('expenses').insert(expense).select().single();
  if (error) throw error;
  
  revalidatePath('/expenses');
  return data;
}

export async function updateExpense(id: string, formData: FormData) {
  const supabase = await createClient();
  
  const unitPrice = parseInt(formData.get('unit_price') as string);
  const quantity = parseInt(formData.get('quantity') as string) || 1;
  
  const updates = {
    date: formData.get('date') as string,
    item_name: formData.get('item_name') as string,
    category: formData.get('category') as string,
    unit_price: unitPrice,
    quantity: quantity,
    total_amount: unitPrice * quantity,
    payment_method: formData.get('payment_method') as string,
    card_company: formData.get('card_company') as string || null,
    vendor: formData.get('vendor') as string || null,
    note: formData.get('note') as string || null,
  };
  
  const { error } = await supabase.from('expenses').update(updates).eq('id', id);
  if (error) throw error;
  
  revalidatePath('/expenses');
}

export async function deleteExpense(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
  
  revalidatePath('/expenses');
}

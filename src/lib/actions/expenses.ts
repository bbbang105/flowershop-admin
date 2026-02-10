'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth-guard';
import type { Expense } from '@/types/database';
import { expenseSchema } from '@/lib/validations';

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

export async function getExpenseById(id: string): Promise<Expense | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) return null;
  return data as Expense;
}

export async function createExpense(formData: FormData) {
  await requireAuth();
  const supabase = await createClient();

  const unitPrice = parseInt(formData.get('unit_price') as string) || 0;
  const quantity = parseInt(formData.get('quantity') as string) || 1;

  const parsed = expenseSchema.safeParse({
    date: formData.get('date'),
    item_name: formData.get('item_name'),
    category: formData.get('category'),
    unit_price: unitPrice,
    quantity: quantity,
    payment_method: formData.get('payment_method'),
    card_company: formData.get('card_company') || null,
    vendor: formData.get('vendor') || null,
    note: formData.get('note') || null,
  });
  if (!parsed.success) {
    throw new Error(`입력값이 올바르지 않습니다: ${parsed.error.issues[0]?.message}`);
  }

  const expense = {
    date: parsed.data.date,
    item_name: parsed.data.item_name,
    category: parsed.data.category,
    unit_price: parsed.data.unit_price,
    quantity: parsed.data.quantity,
    total_amount: parsed.data.unit_price * parsed.data.quantity,
    payment_method: parsed.data.payment_method,
    card_company: parsed.data.card_company || null,
    vendor: parsed.data.vendor || null,
    note: parsed.data.note || null,
  };

  const { data, error } = await supabase.from('expenses').insert(expense).select().single();
  if (error) throw error;
  
  revalidatePath('/expenses');
  return data;
}

export async function updateExpense(id: string, formData: FormData) {
  await requireAuth();
  const supabase = await createClient();

  const unitPrice = parseInt(formData.get('unit_price') as string) || 0;
  const quantity = parseInt(formData.get('quantity') as string) || 1;

  const parsed = expenseSchema.safeParse({
    date: formData.get('date'),
    item_name: formData.get('item_name'),
    category: formData.get('category'),
    unit_price: unitPrice,
    quantity: quantity,
    payment_method: formData.get('payment_method'),
    card_company: formData.get('card_company') || null,
    vendor: formData.get('vendor') || null,
    note: formData.get('note') || null,
  });
  if (!parsed.success) {
    throw new Error(`입력값이 올바르지 않습니다: ${parsed.error.issues[0]?.message}`);
  }

  const updates = {
    date: parsed.data.date,
    item_name: parsed.data.item_name,
    category: parsed.data.category,
    unit_price: parsed.data.unit_price,
    quantity: parsed.data.quantity,
    total_amount: parsed.data.unit_price * parsed.data.quantity,
    payment_method: parsed.data.payment_method,
    card_company: parsed.data.card_company || null,
    vendor: parsed.data.vendor || null,
    note: parsed.data.note || null,
  };

  const { error } = await supabase.from('expenses').update(updates).eq('id', id);
  if (error) throw error;
  
  revalidatePath('/expenses');
}

export async function deleteExpense(id: string) {
  await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
  
  revalidatePath('/expenses');
}

'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Customer, CustomerGrade } from '@/types/database';

export async function getCustomers() {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('total_purchase_amount', { ascending: false });
  
  if (error) throw error;
  return data as Customer[];
}

export async function getCustomerById(id: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Customer;
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

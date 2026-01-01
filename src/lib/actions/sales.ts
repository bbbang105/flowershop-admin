'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Sale } from '@/types/database';

const BUCKET_NAME = 'sale-photos';

export async function getSales(month?: string) {
  const supabase = await createClient();
  
  let query = supabase
    .from('sales')
    .select(`
      *,
      customer:customers(id, name, phone)
    `)
    .order('date', { ascending: false });
  
  if (month) {
    const [year, m] = month.split('-').map(Number);
    const startDate = new Date(year, m - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, m, 0).toISOString().split('T')[0];
    query = query.gte('date', startDate).lte('date', endDate);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  
  // 고객 정보를 매출 데이터에 병합
  const salesWithCustomer = (data || []).map(sale => ({
    ...sale,
    customer_name: sale.customer?.name || sale.customer_name,
    customer_phone: sale.customer?.phone || sale.customer_phone,
  }));
  
  return salesWithCustomer as Sale[];
}

export async function createSale(formData: FormData) {
  const supabase = await createClient();
  
  const productCategory = formData.get('product_category') as string;
  const customerName = formData.get('customer_name') as string || null;
  const customerPhone = formData.get('customer_phone') as string || null;
  const customerId = formData.get('customer_id') as string || null;
  
  // 고객 ID 처리: 기존 고객 선택 또는 새 고객 자동 생성
  let finalCustomerId = customerId || null;
  
  if (!finalCustomerId && customerName && customerName.trim()) {
    // 전화번호가 있으면 먼저 기존 고객 찾기
    if (customerPhone && customerPhone.trim()) {
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', customerPhone.trim())
        .single();
      
      if (existingCustomer) {
        finalCustomerId = existingCustomer.id;
      }
    }
    
    // 기존 고객 없으면 새로 생성
    if (!finalCustomerId) {
      const tempPhone = customerPhone?.trim() || `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          name: customerName.trim(),
          phone: tempPhone,
          grade: 'new',
          total_purchase_count: 0,
          total_purchase_amount: 0
        })
        .select('id')
        .single();
      
      if (!customerError && newCustomer) {
        finalCustomerId = newCustomer.id;
      } else if (customerError?.code === '23505' && customerPhone) {
        // 전화번호 중복이면 기존 고객 찾기
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('phone', customerPhone.trim())
          .single();
        
        if (existingCustomer) {
          finalCustomerId = existingCustomer.id;
        }
      }
    }
  }
  
  const sale = {
    date: formData.get('date') as string,
    product_name: productCategory,
    product_category: productCategory,
    amount: parseInt(formData.get('amount') as string),
    payment_method: formData.get('payment_method') as string,
    card_company: formData.get('card_company') as string || null,
    fee: formData.get('fee') ? parseInt(formData.get('fee') as string) : null,
    expected_deposit: formData.get('expected_deposit') ? parseInt(formData.get('expected_deposit') as string) : null,
    expected_deposit_date: formData.get('expected_deposit_date') as string || null,
    deposit_status: formData.get('deposit_status') as string || 'not_applicable',
    reservation_channel: formData.get('reservation_channel') as string || 'other',
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_id: finalCustomerId,
    note: formData.get('note') as string || null,
  };
  
  const { data, error } = await supabase.from('sales').insert(sale).select().single();
  if (error) throw error;
  
  revalidatePath('/sales');
  revalidatePath('/customers');
  revalidatePath('/');
  return data;
}

export async function updateSale(id: string, formData: FormData) {
  const supabase = await createClient();
  
  const customerName = formData.get('customer_name') as string || null;
  const customerPhone = formData.get('customer_phone') as string || null;
  const customerId = formData.get('customer_id') as string || null;
  
  // 고객 ID 처리: 기존 고객 선택 또는 새 고객 자동 생성
  let finalCustomerId = customerId || null;
  
  if (!finalCustomerId && customerName && customerName.trim()) {
    // 전화번호가 있으면 먼저 기존 고객 찾기
    if (customerPhone && customerPhone.trim()) {
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', customerPhone.trim())
        .single();
      
      if (existingCustomer) {
        finalCustomerId = existingCustomer.id;
      }
    }
    
    // 기존 고객 없으면 새로 생성
    if (!finalCustomerId) {
      const tempPhone = customerPhone?.trim() || `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          name: customerName.trim(),
          phone: tempPhone,
          grade: 'new',
          total_purchase_count: 0,
          total_purchase_amount: 0
        })
        .select('id')
        .single();
      
      if (!customerError && newCustomer) {
        finalCustomerId = newCustomer.id;
      } else if (customerError?.code === '23505' && customerPhone) {
        // 전화번호 중복이면 기존 고객 찾기
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('phone', customerPhone.trim())
          .single();
        
        if (existingCustomer) {
          finalCustomerId = existingCustomer.id;
        }
      }
    }
  }
  
  const updates: Record<string, string | number | boolean | null> = {};
  const fields = ['date', 'product_name', 'product_category', 'amount', 'payment_method', 
    'card_company', 'fee', 'expected_deposit', 'expected_deposit_date', 'deposit_status',
    'reservation_channel', 'note', 'has_review'];
  
  fields.forEach(field => {
    const value = formData.get(field);
    if (value !== null && typeof value === 'string') {
      if (['amount', 'fee', 'expected_deposit'].includes(field)) {
        updates[field] = value ? parseInt(value) : null;
      } else if (field === 'has_review') {
        updates[field] = value === 'true';
      } else {
        updates[field] = value || null;
      }
    }
  });
  
  // 고객 정보 추가
  updates.customer_name = customerName;
  updates.customer_phone = customerPhone;
  updates.customer_id = finalCustomerId;
  
  const { error } = await supabase.from('sales').update(updates).eq('id', id);
  if (error) throw error;
  
  revalidatePath('/sales');
  revalidatePath('/customers');
  revalidatePath('/');
}

export async function deleteSale(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('sales').delete().eq('id', id);
  if (error) throw error;
  
  revalidatePath('/sales');
  revalidatePath('/customers');
  revalidatePath('/');
}

export async function confirmDeposits(ids: string[]) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('sales')
    .update({ deposit_status: 'completed', deposited_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw error;
  
  revalidatePath('/deposits');
  revalidatePath('/');
}

// Photo upload functions
export async function uploadSalePhotos(saleId: string, formData: FormData): Promise<string[]> {
  const supabase = await createClient();
  const files = formData.getAll('photos') as File[];
  const uploadedUrls: string[] = [];
  
  for (const file of files) {
    if (!file.size) continue;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${saleId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });
    
    if (error) throw error;
    
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);
    
    uploadedUrls.push(urlData.publicUrl);
  }
  
  // Update sale with photo URLs
  if (uploadedUrls.length > 0) {
    const { data: sale } = await supabase
      .from('sales')
      .select('photos')
      .eq('id', saleId)
      .single();
    
    const existingPhotos = sale?.photos || [];
    const allPhotos = [...existingPhotos, ...uploadedUrls];
    
    const { error: updateError } = await supabase
      .from('sales')
      .update({ photos: allPhotos })
      .eq('id', saleId);
    
    if (updateError) throw updateError;
  }
  
  revalidatePath('/sales');
  revalidatePath('/customers');
  return uploadedUrls;
}

export async function deleteSalePhoto(saleId: string, photoUrl: string): Promise<void> {
  const supabase = await createClient();
  
  // Extract path from URL
  const url = new URL(photoUrl);
  const pathParts = url.pathname.split(`/storage/v1/object/public/${BUCKET_NAME}/`);
  if (pathParts.length >= 2) {
    const filePath = pathParts[1];
    await supabase.storage.from(BUCKET_NAME).remove([filePath]);
  }
  
  // Update sale to remove photo URL
  const { data: sale } = await supabase
    .from('sales')
    .select('photos')
    .eq('id', saleId)
    .single();
  
  if (sale?.photos) {
    const updatedPhotos = sale.photos.filter((p: string) => p !== photoUrl);
    await supabase
      .from('sales')
      .update({ photos: updatedPhotos })
      .eq('id', saleId);
  }
  
  revalidatePath('/sales');
  revalidatePath('/customers');
}

export async function getSaleById(id: string): Promise<Sale | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sales')
    .select(`
      *,
      customer:customers(id, name, phone)
    `)
    .eq('id', id)
    .single();
  
  if (error) return null;
  
  // 고객 정보 병합
  return {
    ...data,
    customer_name: data.customer?.name || data.customer_name,
    customer_phone: data.customer?.phone || data.customer_phone,
  } as Sale;
}

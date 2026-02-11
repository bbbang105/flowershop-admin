'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth-guard';
import { findOrCreateCustomer } from './customers';
import type { Sale } from '@/types/database';
import { saleSchema, idsSchema, uuidSchema, validateImageFile } from '@/lib/validations';

const BUCKET_NAME = 'sale-photos';

/**
 * 매출 폼 데이터에서 고객 ID를 결정한다.
 * 1) 이미 customer_id가 있으면 그대로 사용
 * 2) 이름+전화번호가 있으면 findOrCreateCustomer로 찾기/생성
 * 3) 그 외에는 null
 */
async function resolveCustomerId(
  customerId: string | null,
  customerName: string | null,
  customerPhone: string | null,
): Promise<string | null> {
  if (customerId) return customerId;
  if (!customerName?.trim()) return null;

  if (customerPhone?.trim()) {
    try {
      const customer = await findOrCreateCustomer(customerName.trim(), customerPhone.trim());
      return customer.id;
    } catch {
      return null;
    }
  }

  return null;
}

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
  await requireAuth();
  const supabase = await createClient();

  const productCategory = formData.get('product_category') as string;
  const customerName = formData.get('customer_name') as string || null;
  const customerPhone = formData.get('customer_phone') as string || null;
  const customerId = formData.get('customer_id') as string || null;

  // 입력 검증
  const parsed = saleSchema.safeParse({
    date: formData.get('date'),
    product_category: productCategory,
    amount: parseInt(formData.get('amount') as string) || 0,
    payment_method: formData.get('payment_method'),
    card_company: formData.get('card_company') || null,
    fee: formData.get('fee') ? parseInt(formData.get('fee') as string) : null,
    expected_deposit: formData.get('expected_deposit') ? parseInt(formData.get('expected_deposit') as string) : null,
    expected_deposit_date: formData.get('expected_deposit_date') || null,
    deposit_status: formData.get('deposit_status') || 'not_applicable',
    reservation_channel: formData.get('reservation_channel') || 'other',
    customer_name: customerName,
    customer_phone: customerPhone,
    reservation_id: formData.get('reservation_id') as string || null,
    note: formData.get('note') || null,
  });
  if (!parsed.success) {
    throw new Error(`입력값이 올바르지 않습니다: ${parsed.error.issues[0]?.message}`);
  }

  const finalCustomerId = await resolveCustomerId(customerId, customerName, customerPhone);

  const sale = {
    date: parsed.data.date,
    product_name: productCategory,
    product_category: productCategory,
    amount: parsed.data.amount,
    payment_method: parsed.data.payment_method,
    card_company: parsed.data.card_company || null,
    fee: parsed.data.fee || null,
    expected_deposit: parsed.data.expected_deposit || null,
    expected_deposit_date: parsed.data.expected_deposit_date || null,
    deposit_status: parsed.data.deposit_status || 'not_applicable',
    reservation_channel: parsed.data.reservation_channel || 'other',
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_id: finalCustomerId,
    reservation_id: parsed.data.reservation_id || null,
    note: parsed.data.note || null,
  };

  const { data, error } = await supabase.from('sales').insert(sale).select().single();
  if (error) throw error;

  revalidatePath('/sales');
  revalidatePath('/customers');
  revalidatePath('/');
  return data;
}

export async function updateSale(id: string, formData: FormData) {
  await requireAuth();

  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) throw new Error('올바르지 않은 ID입니다');

  const customerName = formData.get('customer_name') as string || null;
  const customerPhone = formData.get('customer_phone') as string || null;
  const customerId = formData.get('customer_id') as string || null;

  const parsed = saleSchema.partial().safeParse({
    date: formData.get('date') || undefined,
    product_category: formData.get('product_category') || undefined,
    amount: formData.get('amount') ? parseInt(formData.get('amount') as string) : undefined,
    payment_method: formData.get('payment_method') || undefined,
    card_company: formData.get('card_company') || null,
    fee: formData.get('fee') ? parseInt(formData.get('fee') as string) : null,
    expected_deposit: formData.get('expected_deposit') ? parseInt(formData.get('expected_deposit') as string) : null,
    expected_deposit_date: formData.get('expected_deposit_date') || null,
    deposit_status: formData.get('deposit_status') || undefined,
    reservation_channel: formData.get('reservation_channel') || undefined,
    customer_name: customerName,
    customer_phone: customerPhone,
    note: formData.get('note') || null,
  });
  if (!parsed.success) {
    throw new Error(`입력값이 올바르지 않습니다: ${parsed.error.issues[0]?.message}`);
  }

  const supabase = await createClient();
  const finalCustomerId = await resolveCustomerId(customerId, customerName, customerPhone);

  const updates: Record<string, string | number | boolean | null | undefined> = {
    ...parsed.data,
    product_name: parsed.data.product_category,
    customer_id: finalCustomerId,
  };

  const hasReview = formData.get('has_review');
  if (hasReview !== null) {
    updates.has_review = hasReview === 'true';
  }

  const { error } = await supabase.from('sales').update(updates).eq('id', id);
  if (error) throw error;

  revalidatePath('/sales');
  revalidatePath('/customers');
  revalidatePath('/');
}

export async function deleteSale(id: string) {
  await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase.from('sales').delete().eq('id', id);
  if (error) throw error;
  
  revalidatePath('/sales');
  revalidatePath('/customers');
  revalidatePath('/');
}

export async function confirmDeposits(ids: string[]) {
  await requireAuth();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) throw new Error('올바르지 않은 ID 목록입니다');
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
  await requireAuth();
  const supabase = await createClient();
  const files = formData.getAll('photos') as File[];
  const uploadedUrls: string[] = [];
  
  for (const file of files) {
    if (!file.size) continue;

    const imageError = validateImageFile(file);
    if (imageError) throw new Error(imageError);

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
  await requireAuth();
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

'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { CardCompanySetting } from '@/types/database';
import { requireAuth } from '@/lib/auth-guard';

// ============ Card Company Settings ============

export async function getCardCompanySettings(): Promise<CardCompanySetting[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('card_company_settings')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return data as CardCompanySetting[];
}

export async function updateCardCompanySetting(
  id: string, 
  updates: { fee_rate?: number; deposit_days?: number }
): Promise<void> {
  await requireAuth();

  const supabase = await createClient();
  
  const { error } = await supabase
    .from('card_company_settings')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
  revalidatePath('/settings');
}

export async function createCardCompanySetting(
  name: string, 
  feeRate: number = 2.0, 
  depositDays: number = 3
): Promise<CardCompanySetting> {
  await requireAuth();

  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('card_company_settings')
    .insert({ name, fee_rate: feeRate, deposit_days: depositDays })
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/settings');
  return data as CardCompanySetting;
}

export async function deleteCardCompanySetting(id: string): Promise<void> {
  await requireAuth();

  const supabase = await createClient();
  
  const { error } = await supabase
    .from('card_company_settings')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
  revalidatePath('/settings');
}


// ============ Product Categories ============

export interface ProductCategory {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export async function getProductCategories(): Promise<ProductCategory[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('product_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw error;
  return data as ProductCategory[];
}

export async function createProductCategory(name: string): Promise<ProductCategory> {
  await requireAuth();

  const supabase = await createClient();
  
  // 현재 최대 sort_order 가져오기
  const { data: existing } = await supabase
    .from('product_categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 1;
  
  const { data, error } = await supabase
    .from('product_categories')
    .insert({ name, sort_order: nextOrder })
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/settings');
  return data as ProductCategory;
}

export async function updateProductCategory(
  id: string, 
  updates: { name?: string; sort_order?: number }
): Promise<void> {
  await requireAuth();

  const supabase = await createClient();
  
  const { error } = await supabase
    .from('product_categories')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
  revalidatePath('/settings');
}

export async function deleteProductCategory(id: string): Promise<void> {
  await requireAuth();

  const supabase = await createClient();
  
  const { error } = await supabase
    .from('product_categories')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
  revalidatePath('/settings');
}

// ============ Bulk Update ============

export async function saveAllSettings(
  cardSettings: Array<{ id: string; fee_rate: number; deposit_days: number }>,
  categories: string[]
): Promise<void> {
  await requireAuth();

  const supabase = await createClient();

  // 카드 설정 업데이트
  for (const setting of cardSettings) {
    const { error } = await supabase
      .from('card_company_settings')
      .update({ fee_rate: setting.fee_rate, deposit_days: setting.deposit_days })
      .eq('id', setting.id);
    if (error) throw error;
  }

  // 기존 카테고리 비활성화
  await supabase
    .from('product_categories')
    .update({ is_active: false })
    .eq('is_active', true);

  // 새 카테고리 upsert
  for (let i = 0; i < categories.length; i++) {
    const name = categories[i];
    const { data: existing } = await supabase
      .from('product_categories')
      .select('id')
      .eq('name', name)
      .single();

    if (existing) {
      await supabase
        .from('product_categories')
        .update({ is_active: true, sort_order: i + 1 })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('product_categories')
        .insert({ name, sort_order: i + 1, is_active: true });
    }
  }

  revalidatePath('/settings');
  revalidatePath('/sales');
}

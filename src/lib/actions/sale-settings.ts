'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth-guard';
import { withErrorLogging, AppError, ErrorCode } from '@/lib/errors';

export interface SaleCategory {
  id: string;
  value: string;
  label: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  value: string;
  label: string;
  color: string;
  sort_order: number;
  created_at: string;
}

// 카테고리 조회
async function _getSaleCategories(): Promise<SaleCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sale_categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export const getSaleCategories = withErrorLogging('getSaleCategories', _getSaleCategories);

// 카테고리 생성
async function _createSaleCategory(label: string, color?: string): Promise<SaleCategory> {
  await requireAuth();
  const supabase = await createClient();

  // value 생성 (영문 스네이크케이스)
  const value = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || `cat_${Date.now()}`;

  // 최대 sort_order 조회
  const { data: maxData } = await supabase
    .from('sale_categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = (maxData?.[0]?.sort_order || 0) + 1;

  const { data, error } = await supabase
    .from('sale_categories')
    .insert({ value, label, color: color || '#f43f5e', sort_order: nextOrder })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError(ErrorCode.DUPLICATE, '이미 존재하는 카테고리입니다');
    }
    throw error;
  }

  revalidatePath('/sales');
  return data;
}

export const createSaleCategory = withErrorLogging('createSaleCategory', _createSaleCategory);

// 카테고리 수정
async function _updateSaleCategory(id: string, label: string, color: string): Promise<void> {
  await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase
    .from('sale_categories')
    .update({ label, color })
    .eq('id', id);

  if (error) {
    if (error.code === '23505') {
      throw new AppError(ErrorCode.DUPLICATE, '이미 존재하는 카테고리입니다');
    }
    throw error;
  }

  revalidatePath('/sales');
}

export const updateSaleCategory = withErrorLogging('updateSaleCategory', _updateSaleCategory);

// 카테고리 삭제
async function _deleteSaleCategory(id: string): Promise<void> {
  await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase
    .from('sale_categories')
    .delete()
    .eq('id', id);

  if (error) throw error;

  revalidatePath('/sales');
}

export const deleteSaleCategory = withErrorLogging('deleteSaleCategory', _deleteSaleCategory);

// 결제방식 조회
async function _getPaymentMethods(): Promise<PaymentMethod[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export const getPaymentMethods = withErrorLogging('getPaymentMethods', _getPaymentMethods);

// 결제방식 생성 (주의: value는 sales 테이블 CHECK 제약조건에 맞아야 함)
// 기본 결제방식: cash, card, transfer, naverpay, kakaopay
async function _createPaymentMethod(label: string, color?: string, value?: string): Promise<PaymentMethod> {
  await requireAuth();
  const supabase = await createClient();

  // value가 없으면 생성 (영문 스네이크케이스)
  const finalValue = value || label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || `pay_${Date.now()}`;

  // 최대 sort_order 조회
  const { data: maxData } = await supabase
    .from('payment_methods')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = (maxData?.[0]?.sort_order || 0) + 1;

  const { data, error } = await supabase
    .from('payment_methods')
    .insert({ value: finalValue, label, color: color || '#3b82f6', sort_order: nextOrder })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError(ErrorCode.DUPLICATE, '이미 존재하는 결제방식입니다');
    }
    throw error;
  }

  revalidatePath('/sales');
  return data;
}

export const createPaymentMethod = withErrorLogging('createPaymentMethod', _createPaymentMethod);

// 결제방식 수정 (value는 수정 불가 - CHECK 제약조건 때문)
async function _updatePaymentMethod(id: string, label: string, color: string): Promise<void> {
  await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase
    .from('payment_methods')
    .update({ label, color })
    .eq('id', id);

  if (error) {
    if (error.code === '23505') {
      throw new AppError(ErrorCode.DUPLICATE, '이미 존재하는 결제방식입니다');
    }
    throw error;
  }

  revalidatePath('/sales');
}

export const updatePaymentMethod = withErrorLogging('updatePaymentMethod', _updatePaymentMethod);

// 결제방식 삭제
async function _deletePaymentMethod(id: string): Promise<void> {
  await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase
    .from('payment_methods')
    .delete()
    .eq('id', id);

  if (error) throw error;

  revalidatePath('/sales');
}

export const deletePaymentMethod = withErrorLogging('deletePaymentMethod', _deletePaymentMethod);

'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth-guard';
import { createSale } from './sales';
import type { Reservation, ReservationStatus, Sale } from '@/types/database';
import { reservationSchema, uuidSchema } from '@/lib/validations';
import { withErrorLogging } from '@/lib/errors';

async function _getReservations(month: string): Promise<{ success: boolean; data?: Reservation[]; error?: string }> {
  const supabase = await createClient();
  const [year, m] = month.split('-').map(Number);
  const startDate = new Date(year, m - 1, 1).toISOString().split('T')[0];
  const endDate = new Date(year, m, 0).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')
    .order('time', { nullsFirst: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as Reservation[] };
}

export const getReservations = withErrorLogging('getReservations', _getReservations);

async function _createReservation(formData: {
  date: string;
  time?: string;
  customer_name: string;
  customer_phone?: string;
  title: string;
  description?: string;
  estimated_amount?: number;
  status?: ReservationStatus;
  reminder_date?: string | null;
}): Promise<{ success: boolean; data?: Reservation; error?: string }> {
  await requireAuth();

  const parsed = reservationSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: `입력값이 올바르지 않습니다: ${parsed.error.issues[0]?.message}` };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('reservations')
    .insert({
      date: parsed.data.date,
      time: parsed.data.time || null,
      customer_name: parsed.data.customer_name,
      customer_phone: parsed.data.customer_phone || null,
      title: parsed.data.title,
      description: parsed.data.description || null,
      estimated_amount: parsed.data.estimated_amount || 0,
      status: parsed.data.status || 'pending',
      reminder_date: parsed.data.reminder_date || null,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as Reservation };
}

export const createReservation = withErrorLogging('createReservation', _createReservation);

async function _updateReservation(
  id: string,
  formData: {
    date?: string;
    time?: string | null;
    customer_name?: string;
    customer_phone?: string | null;
    title?: string;
    description?: string | null;
    estimated_amount?: number;
    status?: ReservationStatus;
    sale_id?: string | null;
    reminder_date?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  await requireAuth();

  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return { success: false, error: '올바르지 않은 ID입니다' };

  const parsed = reservationSchema.partial().safeParse({
    date: formData.date,
    time: formData.time,
    customer_name: formData.customer_name,
    customer_phone: formData.customer_phone,
    title: formData.title,
    description: formData.description,
    estimated_amount: formData.estimated_amount,
    status: formData.status,
    reminder_date: formData.reminder_date,
  });
  if (!parsed.success) {
    return { success: false, error: `입력값이 올바르지 않습니다: ${parsed.error.issues[0]?.message}` };
  }

  const updates: Record<string, unknown> = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };
  if (formData.sale_id !== undefined) {
    const saleParsed = formData.sale_id ? uuidSchema.safeParse(formData.sale_id) : null;
    if (formData.sale_id && (!saleParsed || !saleParsed.success)) {
      return { success: false, error: '올바르지 않은 매출 ID입니다' };
    }
    updates.sale_id = formData.sale_id;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('reservations')
    .update(updates)
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export const updateReservation = withErrorLogging('updateReservation', _updateReservation);

async function _deleteReservation(id: string): Promise<{ success: boolean; error?: string }> {
  await requireAuth();
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return { success: false, error: '올바르지 않은 ID입니다' };
  const supabase = await createClient();
  const { error } = await supabase.from('reservations').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export const deleteReservation = withErrorLogging('deleteReservation', _deleteReservation);

/**
 * 예약을 매출로 변환한다.
 * 1) 예약 조회 → 2) 매출 생성 (FormData 사용) → 3) 예약 상태 completed + sale_id 연결
 */
async function _convertReservationToSale(
  reservationId: string,
  saleFormData: FormData,
): Promise<{ success: boolean; sale?: Sale; error?: string }> {
  await requireAuth();
  const supabase = await createClient();

  // 1. 예약 조회
  const { data: reservation, error: fetchError } = await supabase
    .from('reservations')
    .select('*')
    .eq('id', reservationId)
    .single();

  if (fetchError || !reservation) {
    return { success: false, error: '예약을 찾을 수 없습니다' };
  }

  // 2. FormData에 reservation_id 포함하여 매출 생성
  saleFormData.set('reservation_id', reservationId);

  try {
    const sale = await createSale(saleFormData);

    // 3. 예약 상태 업데이트: completed + sale_id 연결
    await supabase
      .from('reservations')
      .update({
        status: 'completed',
        sale_id: sale.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reservationId);

    revalidatePath('/calendar');
    revalidatePath('/');
    return { success: true, sale: sale as Sale };
  } catch (error: unknown) {
    return { success: false, error: (error instanceof Error ? error.message : '매출 등록에 실패했습니다') };
  }
}

export const convertReservationToSale = withErrorLogging('convertReservationToSale', _convertReservationToSale);

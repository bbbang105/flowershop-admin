'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { createSale } from './sales';
import type { Reservation, ReservationStatus, Sale } from '@/types/database';

export async function getReservations(month: string): Promise<{ success: boolean; data?: Reservation[]; error?: string }> {
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

export async function createReservation(formData: {
  date: string;
  time?: string;
  customer_name: string;
  customer_phone?: string;
  title: string;
  description?: string;
  estimated_amount?: number;
  status?: ReservationStatus;
}): Promise<{ success: boolean; data?: Reservation; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('reservations')
    .insert({
      date: formData.date,
      time: formData.time || null,
      customer_name: formData.customer_name,
      customer_phone: formData.customer_phone || null,
      title: formData.title,
      description: formData.description || null,
      estimated_amount: formData.estimated_amount || 0,
      status: formData.status || 'pending',
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as Reservation };
}

export async function updateReservation(
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
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('reservations')
    .update({ ...formData, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteReservation(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('reservations').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * 예약을 매출로 변환한다.
 * 1) 예약 조회 → 2) 매출 생성 (FormData 사용) → 3) 예약 상태 completed + sale_id 연결
 */
export async function convertReservationToSale(
  reservationId: string,
  saleFormData: FormData,
): Promise<{ success: boolean; sale?: Sale; error?: string }> {
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
  } catch (error: any) {
    return { success: false, error: error.message || '매출 등록에 실패했습니다' };
  }
}

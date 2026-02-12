import type { PaymentMethod, ReservationChannel, ExpenseCategory } from '@/types/database';

// ─── 결제방식 라벨 ─────────────────────────────────────────────
export const PAYMENT_LABELS: Record<string, string> = {
  cash: '현금',
  card: '카드',
  transfer: '계좌이체',
  naverpay: '네이버페이',
  kakaopay: '카카오페이',
} satisfies Record<PaymentMethod | 'kakaopay', string>;

// ─── 채널 라벨 ─────────────────────────────────────────────────
export const CHANNEL_LABELS: Record<string, string> = {
  phone: '전화',
  kakaotalk: '카카오톡',
  naver_booking: '네이버예약',
  road: '로드',
  other: '기타',
} satisfies Record<ReservationChannel, string>;

// ─── 지출 카테고리 라벨 ────────────────────────────────────────
export const EXPENSE_LABELS: Record<string, string> = {
  flower_purchase: '꽃 사입',
  delivery: '배송비',
  advertising: '광고비',
  rent: '임대료',
  utilities: '공과금',
  supplies: '소모품',
  other: '기타',
} satisfies Record<ExpenseCategory, string>;

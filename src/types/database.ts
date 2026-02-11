export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'naverpay';
export type DepositStatus = 'pending' | 'completed' | 'not_applicable';
export type ExpenseCategory = 'flower_purchase' | 'delivery' | 'advertising' | 'rent' | 'utilities' | 'supplies' | 'other';
export type CustomerGrade = 'new' | 'regular' | 'vip' | 'blacklist';
export type CustomerGender = 'male' | 'female';
export type ReservationChannel = 'phone' | 'kakaotalk' | 'naver_booking' | 'road' | 'other';

export type ProductCategory = 
  | 'mini_bouquet' 
  | 'basic_bouquet' 
  | 'medium_bouquet' 
  | 'large_bouquet' 
  | 'special_bouquet' 
  | 'proposal_bouquet' 
  | 'basket' 
  | 'vase' 
  | 'group_bouquet' 
  | 'reservation' 
  | 'photo_bouquet';

export const PRODUCT_CATEGORIES = [
  { value: 'mini_bouquet', label: '미니 꽃다발' },
  { value: 'basic_bouquet', label: '기본 꽃다발' },
  { value: 'medium_bouquet', label: '중형 꽃다발' },
  { value: 'large_bouquet', label: '대형 꽃다발' },
  { value: 'special_bouquet', label: '스페셜 꽃다발' },
  { value: 'proposal_bouquet', label: '프로포즈 꽃다발' },
  { value: 'basket', label: '꽃바구니' },
  { value: 'vase', label: '화병꽂이' },
  { value: 'group_bouquet', label: '단체꽃다발' },
  { value: 'reservation', label: '예약' },
  { value: 'photo_bouquet', label: '촬영부케' },
] as const;

export const PAYMENT_METHODS = [
  { value: 'card', label: '카드' },
  { value: 'naverpay', label: '네이버페이' },
  { value: 'transfer', label: '계좌이체' },
  { value: 'cash', label: '현금' },
] as const;

export interface Sale {
  id: string;
  date: string;
  product_name: string;
  product_category: string;
  amount: number;
  payment_method: PaymentMethod;
  card_company?: string;
  fee?: number;
  expected_deposit?: number;
  expected_deposit_date?: string;
  deposit_status: DepositStatus;
  deposited_at?: string;
  reservation_channel: ReservationChannel;
  customer_name?: string;
  customer_phone?: string;
  customer_id?: string;
  note?: string;
  has_review: boolean;
  photos?: string[];
  reservation_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  date: string;
  item_name: string;
  category: ExpenseCategory;
  unit_price: number;
  quantity: number;
  total_amount: number;
  payment_method: PaymentMethod;
  card_company?: string;
  vendor?: string;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  grade: CustomerGrade;
  gender?: CustomerGender | null;
  total_purchase_count: number;
  total_purchase_amount: number;
  first_purchase_date?: string;
  last_purchase_date?: string;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface CardCompanySetting {
  id: string;
  name: string;
  fee_rate: number;
  deposit_days: number;
  is_active: boolean;
}

// Sale Settings Types
export interface SaleCategory {
  id: string;
  value: string;
  label: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface SalePaymentMethod {
  id: string;
  value: string;
  label: string;
  color: string;
  sort_order: number;
  created_at: string;
}


// Photo Gallery Types
export interface PhotoTag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface PhotoFile {
  url: string;
  originalName: string;
}

export interface PhotoCard {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  photos: PhotoFile[];
  sale_id: string | null;
  created_at: string;
  updated_at: string;
}

// Reservation Types
export type ReservationStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface Reservation {
  id: string;
  date: string;
  time: string | null;
  customer_name: string;
  customer_phone: string | null;
  title: string;
  description: string | null;
  status: ReservationStatus;
  sale_id: string | null;
  estimated_amount: number;
  reminder_at: string | null;
  created_at: string;
  updated_at: string;
}

export const RESERVATION_STATUS = [
  { value: 'pending', label: '대기', color: '#F5A623' },
  { value: 'confirmed', label: '확정', color: '#5B8DEF' },
  { value: 'completed', label: '완료', color: '#8B9D83' },
  { value: 'cancelled', label: '취소', color: '#9B9B93' },
] as const;

export const PHOTO_TAG_COLORS = [
  { value: '#f5f5f5', label: '화이트' },
  { value: '#ec4899', label: '핑크' },
  { value: '#ef4444', label: '레드' },
  { value: '#eab308', label: '옐로우' },
  { value: '#a855f7', label: '퍼플' },
  { value: '#6366f1', label: '인디고' },
  { value: '#14b8a6', label: '틸' },
  { value: '#f97316', label: '오렌지' },
  { value: '#6b7280', label: '그레이' },
] as const;

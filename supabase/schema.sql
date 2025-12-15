-- 헤이즐 어드민 Supabase 스키마

-- 고객 테이블
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  grade VARCHAR(20) DEFAULT 'new' CHECK (grade IN ('new', 'regular', 'vip', 'blacklist')),
  total_purchase_count INTEGER DEFAULT 0,
  total_purchase_amount INTEGER DEFAULT 0,
  first_purchase_date TIMESTAMPTZ,
  last_purchase_date TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 매출 테이블
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  product_category VARCHAR(100),
  amount INTEGER NOT NULL,
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'naverpay', 'kakaopay')),
  card_company VARCHAR(50),
  fee INTEGER,
  expected_deposit INTEGER,
  expected_deposit_date DATE,
  deposit_status VARCHAR(20) DEFAULT 'not_applicable' CHECK (deposit_status IN ('pending', 'completed', 'not_applicable')),
  deposited_at TIMESTAMPTZ,
  reservation_channel VARCHAR(20) DEFAULT 'other' CHECK (reservation_channel IN ('phone', 'kakaotalk', 'naver_booking', 'road', 'other')),
  customer_name VARCHAR(100),
  customer_phone VARCHAR(20),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  note TEXT,
  has_review BOOLEAN DEFAULT FALSE,
  photos TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 지출 테이블
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  item_name VARCHAR(200) NOT NULL,
  category VARCHAR(30) NOT NULL CHECK (category IN ('flower_purchase', 'delivery', 'advertising', 'rent', 'utilities', 'supplies', 'other')),
  unit_price INTEGER NOT NULL,
  quantity INTEGER DEFAULT 1,
  total_amount INTEGER NOT NULL,
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'naverpay', 'kakaopay')),
  card_company VARCHAR(50),
  vendor VARCHAR(100),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 카드사 설정 테이블
CREATE TABLE card_company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  fee_rate DECIMAL(5,2) DEFAULT 2.0,
  deposit_days INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 상품 카테고리 테이블 (매출용)
-- value: DB에 저장되는 값 (영문), label: UI에 표시되는 값 (한글)
CREATE TABLE sale_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value VARCHAR(100) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#f43f5e',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 결제방식 테이블
-- value: DB에 저장되는 값 (영문, sales 테이블 CHECK 제약조건과 일치해야 함)
-- label: UI에 표시되는 값 (한글)
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value VARCHAR(20) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#3b82f6',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 카드사 설정 데이터
INSERT INTO card_company_settings (name, fee_rate, deposit_days) VALUES
  ('신한카드', 2.0, 3),
  ('국민카드', 2.0, 3),
  ('삼성카드', 2.2, 2),
  ('현대카드', 2.1, 3),
  ('롯데카드', 2.0, 3),
  ('하나카드', 2.0, 3),
  ('우리카드', 2.0, 3),
  ('BC카드', 2.0, 3);

-- 기본 매출 카테고리 데이터
INSERT INTO sale_categories (value, label, color, sort_order) VALUES
  ('mini_bouquet', '미니 꽃다발', '#f43f5e', 1),
  ('basic_bouquet', '기본 꽃다발', '#f43f5e', 2),
  ('medium_bouquet', '중형 꽃다발', '#f43f5e', 3),
  ('large_bouquet', '대형 꽃다발', '#f43f5e', 4),
  ('special_bouquet', '스페셜 꽃다발', '#f43f5e', 5),
  ('proposal_bouquet', '프로포즈 꽃다발', '#f43f5e', 6),
  ('basket', '꽃바구니', '#fb923c', 7),
  ('vase', '화병꽂이', '#06b6d4', 8),
  ('group_bouquet', '단체꽃다발', '#6366f1', 9),
  ('reservation', '예약', '#f97316', 10),
  ('photo_bouquet', '촬영부케', '#ec4899', 11);

-- 기본 결제방식 데이터 (value는 sales 테이블 CHECK 제약조건과 일치)
INSERT INTO payment_methods (value, label, color, sort_order) VALUES
  ('card', '카드', '#3b82f6', 1),
  ('naverpay', '네이버페이', '#10b981', 2),
  ('transfer', '계좌이체', '#8b5cf6', 3),
  ('cash', '현금', '#22c55e', 4);

-- 인덱스
CREATE INDEX idx_sales_date ON sales(date);
CREATE INDEX idx_sales_customer_id ON sales(customer_id);
CREATE INDEX idx_sales_payment_method ON sales(payment_method);
CREATE INDEX idx_sales_deposit_status ON sales(deposit_status);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_grade ON customers(grade);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_card_settings_updated_at BEFORE UPDATE ON card_company_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Storage 버킷 설정 (Supabase Dashboard에서 생성 필요)
-- 1. Storage 메뉴에서 "New bucket" 클릭
-- 2. 버킷 이름: sale-photos
-- 3. Public bucket: 체크 (이미지 공개 접근 허용)
-- 4. File size limit: 5MB (권장)
-- 5. Allowed MIME types: image/* (이미지만 허용)

-- Storage RLS 정책 (SQL Editor에서 실행)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('sale-photos', 'sale-photos', true);

-- 업로드 정책 (인증된 사용자만)
-- CREATE POLICY "Allow authenticated uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'sale-photos');

-- 읽기 정책 (모든 사용자)
-- CREATE POLICY "Allow public read" ON storage.objects FOR SELECT USING (bucket_id = 'sale-photos');

-- 삭제 정책 (인증된 사용자만)
-- CREATE POLICY "Allow authenticated deletes" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'sale-photos');


-- =============================================
-- 사진첩 (Photo Gallery) 테이블
-- =============================================

-- 사진 태그 테이블
CREATE TABLE photo_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  color VARCHAR(7) DEFAULT '#6b7280',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사진 카드 테이블
-- photos: [{url: string, originalName: string}, ...]
CREATE TABLE photo_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  photos JSONB DEFAULT '[]',
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사진 카드 인덱스
CREATE INDEX idx_photo_cards_tags ON photo_cards USING GIN(tags);
CREATE INDEX idx_photo_cards_sale_id ON photo_cards(sale_id);
CREATE INDEX idx_photo_cards_created_at ON photo_cards(created_at DESC);

-- 사진 카드 updated_at 트리거
CREATE TRIGGER update_photo_cards_updated_at BEFORE UPDATE ON photo_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 기본 사진 태그 데이터
INSERT INTO photo_tags (name, color) VALUES
  ('화이트', '#f5f5f5'),
  ('핑크', '#ec4899'),
  ('레드', '#ef4444'),
  ('옐로우', '#eab308'),
  ('퍼플', '#a855f7'),
  ('믹스', '#6366f1'),
  ('웨딩', '#f472b6'),
  ('프로포즈', '#f43f5e'),
  ('생일', '#f97316'),
  ('기념일', '#14b8a6');

-- Storage 버킷 설정 (photo-cards)
-- Supabase Dashboard에서 실행:
-- 1. Storage 메뉴에서 "New bucket" 클릭
-- 2. 버킷 이름: photo-cards
-- 3. Public bucket: 체크 (이미지 공개 접근 허용)
-- 4. File size limit: 10MB
-- 5. Allowed MIME types: 비워두기 (모든 타입 허용)

-- Storage RLS 정책 (photo-cards 버킷) - SQL Editor에서 실행
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
--   VALUES ('photo-cards', 'photo-cards', true, 10485760, NULL);

-- 모든 사용자 업로드 허용 (public bucket)
-- CREATE POLICY "Allow public uploads photo-cards" ON storage.objects 
--   FOR INSERT WITH CHECK (bucket_id = 'photo-cards');

-- 모든 사용자 읽기 허용
-- CREATE POLICY "Allow public read photo-cards" ON storage.objects 
--   FOR SELECT USING (bucket_id = 'photo-cards');

-- 모든 사용자 업데이트 허용
-- CREATE POLICY "Allow public update photo-cards" ON storage.objects 
--   FOR UPDATE USING (bucket_id = 'photo-cards');

-- 모든 사용자 삭제 허용
-- CREATE POLICY "Allow public delete photo-cards" ON storage.objects 
--   FOR DELETE USING (bucket_id = 'photo-cards');

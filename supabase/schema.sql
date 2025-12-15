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

-- 상품 카테고리 테이블
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
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

-- 기본 상품 카테고리 데이터
INSERT INTO product_categories (name, sort_order) VALUES
  ('꽃다발', 1),
  ('꽃바구니', 2),
  ('화병', 3),
  ('화환', 4),
  ('기타', 5);

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

# Hazel Admin - 꽃집 관리 시스템

## 프로젝트 개요

꽃집(헤이즐) 매출/지출/고객/사진첩을 관리하는 어드민 웹앱. 기존 엑셀 스프레드시트를 대체.

## 기술 스택

| 항목 | 기술 |
|------|------|
| Framework | Next.js 16 (App Router, React 19) |
| Database | Supabase (PostgreSQL) |
| UI | shadcn/ui + Tailwind CSS v4 |
| State | React useState/useMemo (단순 로컬 상태) |
| Toast | sonner |
| Chart | recharts |
| Test | vitest + fast-check (PBT) |
| Image | browser-image-compression (3MB 초과 시 자동 압축) |
| Port | 3100 (`npm run dev` → localhost:3100) |

## 디렉터리 구조

```
src/
├── app/
│   ├── (dashboard)/           # Route Group
│   │   ├── layout.tsx         # 사이드바 포함 공통 레이아웃
│   │   ├── page.tsx           # 대시보드 (/)
│   │   ├── sales/             # 매출 관리
│   │   ├── customers/         # 고객 관리
│   │   ├── expenses/          # 지출 관리
│   │   ├── deposits/          # 입금 대조
│   │   ├── gallery/           # 사진첩
│   │   ├── statistics/        # 통계
│   │   └── settings/          # 설정
│   ├── layout.tsx             # 루트 레이아웃
│   └── globals.css
├── components/
│   ├── ui/                    # shadcn/ui 컴포넌트
│   ├── layout/                # Sidebar, Header 등 레이아웃
│   ├── sales/                 # 매출 관련 (SaleSettingsModal 등)
│   ├── gallery/               # 갤러리 관련 (PhotoCardForm 등)
│   └── expenses/              # 지출 관련 (ExpenseSettingsModal)
├── lib/
│   ├── actions/               # Server Actions ('use server')
│   │   ├── sales.ts           # 매출 CRUD
│   │   ├── customers.ts       # 고객 CRUD + 자동완성
│   │   ├── expenses.ts        # 지출 CRUD
│   │   ├── expense-settings.ts # 지출 카테고리/결제방식 설정
│   │   ├── deposits.ts        # 입금 대조
│   │   ├── dashboard.ts       # 대시보드 통계
│   │   ├── statistics.ts      # 통계 집계
│   │   ├── photo-cards.ts     # 사진 카드 CRUD
│   │   ├── photo-tags.ts      # 사진 태그 CRUD
│   │   ├── sale-settings.ts   # 매출 카테고리/결제방식 설정
│   │   ├── settings.ts        # 카드사 수수료 설정
│   │   └── index.ts           # 공통 유틸
│   ├── supabase/              # Supabase 클라이언트 (server.ts, client.ts)
│   └── utils.ts               # cn() 등 유틸리티
├── types/
│   └── database.ts            # 전체 타입 정의
└── supabase/
    └── schema.sql             # DB 스키마 (테이블, 인덱스, 시드 데이터)
```

## 아키텍처 패턴

### 페이지 구조: Server Component + Client Component
```
page.tsx (Server) → 데이터 fetch → *-client.tsx (Client) → UI 렌더링
```
- `page.tsx`: Server Component. Supabase에서 데이터 fetch 후 Client에 props 전달.
- `*-client.tsx`: Client Component. `'use client'` 선언. 상호작용, 필터, 모달 처리.

### Server Actions
- `src/lib/actions/` 아래 모든 파일은 `'use server'` 선언.
- Supabase 클라이언트는 `createClient()` from `@/lib/supabase/server`.
- CRUD 함수는 `{ success, data?, error? }` 형태 반환.

### 상태 관리
- 로컬 상태만 사용 (useState, useMemo). 글로벌 상태 없음.
- 서버 데이터 변경 후 `router.refresh()`로 서버 데이터 재동기화.

## DB 테이블

| 테이블 | 설명 |
|--------|------|
| `sales` | 매출 (날짜, 상품, 금액, 결제방식, 고객연동) |
| `expenses` | 지출 (단가 x 수량 = 총액 자동계산) |
| `customers` | 고객 (전화번호 unique, 등급: new/regular/vip/blacklist) |
| `card_company_settings` | 카드사 수수료/입금일 설정 |
| `sale_categories` | 매출 상품 카테고리 (DB 기반, 동적) |
| `payment_methods` | 결제방식 (DB 기반, 동적) |
| `photo_cards` | 사진 카드 (최대 10장, JSONB) |
| `photo_tags` | 사진 태그 (색상 포함) |

## 타입 시스템 (src/types/database.ts)

- `PaymentMethod`: `'cash' | 'card' | 'transfer' | 'naverpay'`
- `ExpenseCategory`: `'flower_purchase' | 'delivery' | 'advertising' | 'rent' | 'utilities' | 'supplies' | 'other'`
- `CustomerGrade`: `'new' | 'regular' | 'vip' | 'blacklist'`
- `ReservationChannel`: `'phone' | 'kakaotalk' | 'naver_booking' | 'road' | 'other'`
- `ProductCategory`: 11종 (mini_bouquet ~ photo_bouquet)

## UI/UX 규칙

### 폼
- 엔터키 등록 방지 필수: `onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }}`
- 삭제는 `confirm()` 금지 → Dialog 컴포넌트로 확인 팝업
- 금액 입력: `AmountInput` 컴포넌트 (천 단위 콤마 자동 포맷)
- 전화번호: 자동 포맷팅 (010-0000-0000), 중복 실시간 체크
- 버튼 로딩: `<Button disabled={isLoading}>` + Loader2 스피너

### 컬러
- **Primary**: rose-500 (`#f43f5e`), hover: rose-600
- **결제방식**: 카드 blue / 네이버페이 emerald / 계좌이체 purple / 현금 orange
- **고객 등급**: 신규 gray / 단골 yellow / VIP purple / 블랙리스트 red
- **카테고리 배지**: `backgroundColor: ${color}40`, `color: color` (40% 투명도 배경)

### 네비게이션
- 외부 이동: ExternalLink 아이콘 (lucide-react), `text-rose-500 hover:text-rose-600`

### 데이터 표시
- 통계: DB 하드코딩 금지, 관련 테이블에서 실시간 집계 (RDBMS 방식)
- 고객 구매 통계: sales 테이블에서 customer_id로 JOIN 집계

## 핵심 비즈니스 로직

1. **고객 자동 식별**: 전화번호 기준. 동일 번호 → 동일 고객.
2. **카드 수수료 자동 계산**: 카드사별 수수료율 적용. `expected_deposit = amount * (1 - fee_rate/100)`
3. **입금 예정일**: 영업일 기준 N일 (주말/공휴일 제외)
4. **지출 총액 자동 계산**: `total_amount = unit_price * quantity`
5. **사진 압축**: 3MB 초과 시 browser-image-compression으로 자동 압축
6. **사진 제한**: 카드당 최대 10장, 태그 최대 3개

## 완료된 기능

- 매출 CRUD + 필터 + 요약 카드
- 지출 CRUD + 카테고리/결제방식 설정
- 고객 CRUD + 등급 관리 + 매출 연동 + 자동완성
- 카드 수수료 설정 + 입금 대조
- 사진첩 (카드 CRUD, 태그 시스템, 드래그 순서 변경)
- 대시보드 + 통계
- 토스트 알림 (sonner)

## 코드 규칙

- 한국어 UI (모든 라벨, 메시지, 플레이스홀더)
- Server Actions에서 에러 시 `{ success: false, error: message }` 반환
- 성공/실패 시 `toast.success()` / `toast.error()` 호출
- 서버 데이터 변경 후 반드시 `router.refresh()` 호출
- shadcn/ui 컴포넌트 사용 (import from `@/components/ui/*`)
- 아이콘은 lucide-react 사용

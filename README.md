# 🌸 Hazel Admin

꽃집 매출/지출 관리를 위한 어드민 대시보드

## 기술 스택

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL)
- **UI**: shadcn/ui + Tailwind CSS
- **Font**: Pretendard

## 주요 기능

### ✅ 구현 완료

| 기능 | 설명 |
|------|------|
| 대시보드 | 매출/지출 요약, 최근 거래 내역 |
| 매출 관리 | 매출 등록/수정/삭제, 카테고리별 분류, 카드사 선택 |
| 사진첩 | 작업물 사진 관리, 태그 시스템, 매출 연동 |
| 입금 대조 | 카드사별 입금 예정일 확인, 입금 완료 처리 |
| 지출 관리 | 지출 등록/수정/삭제 |
| 고객 관리 | 고객 정보 관리 |
| 통계 | 매출/지출 통계 차트 |
| 설정 | 카드사 수수료율, 입금 주기 설정 |

### 🔄 세부 기능

- [x] 금액 입력 시 1000단위 콤마 자동 포맷팅
- [x] DB 기반 상품 카테고리 관리 (색상 지정 가능)
- [x] 결제 방식별 매출 요약 카드
- [x] 카드 결제 시 카드사 필수 선택
- [x] 년/월 선택 필터
- [x] 카테고리/결제방식 필터링
- [x] 모바일 반응형 레이아웃
- [x] 사진 업로드 (자동 압축, 드래그 정렬)
- [x] 매출-사진 연동
- [x] 태그 관리 (색상 지정)
- [x] Toast 알림 시스템

### 📋 추가 예정

- [ ] 통계 페이지 고도화
- [ ] 고객별 매출 연동
- [ ] 지출 내역 PDF 내보내기
- [ ] 매출 데이터 Excel/CSV 내보내기
- [ ] 다크 모드

## 시작하기

### 1. 환경 변수 설정

`.env.local` 파일 생성:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 2. Supabase 설정

1. [Supabase](https://supabase.com)에서 프로젝트 생성
2. SQL Editor에서 `supabase/schema.sql` 실행
3. Storage에서 버킷 생성:
   - `sale-photos` - 매출 사진
   - `photo-cards` - 사진첩 이미지

### 3. 개발 서버 실행

```bash
npm install
npm run dev
```

http://localhost:3100 에서 확인

## 프로젝트 구조

```
src/
├── app/                    # Next.js App Router
│   └── (dashboard)/        # 대시보드 레이아웃 그룹
│       ├── page.tsx        # 대시보드
│       ├── sales/          # 매출 관리
│       ├── gallery/        # 사진첩
│       ├── deposits/       # 입금 대조
│       ├── expenses/       # 지출 관리
│       ├── customers/      # 고객 관리
│       ├── statistics/     # 통계
│       └── settings/       # 설정
├── components/
│   ├── layout/             # 레이아웃 컴포넌트
│   ├── sales/              # 매출 관련 컴포넌트
│   ├── gallery/            # 사진첩 관련 컴포넌트
│   └── ui/                 # shadcn/ui 컴포넌트
├── lib/
│   ├── actions/            # Server Actions
│   └── supabase/           # Supabase 클라이언트
└── types/                  # TypeScript 타입 정의
```

## DB 테이블

| 테이블 | 설명 |
|--------|------|
| sales | 매출 내역 |
| expenses | 지출 내역 |
| customers | 고객 정보 |
| sale_categories | 상품 카테고리 (value, label, color) |
| payment_methods | 결제 방식 |
| card_company_settings | 카드사 수수료 설정 |
| photo_cards | 사진첩 카드 |
| photo_tags | 사진 태그 |

## 브랜치 전략

- `main` - 프로덕션
- `dev` - 개발 통합
- `feature/{기능명}` - 기능별 브랜치

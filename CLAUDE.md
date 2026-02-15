~~# Hazel Admin - 꽃집 관리 시스템

꽃집(헤이즐) 매출/지출/고객/사진첩/예약을 관리하는 PWA 어드민 웹앱.

## 핵심 패턴

```
page.tsx (Server) → 데이터 fetch → *-client.tsx (Client) → UI 렌더링
```

- **Server Actions**: `src/lib/actions/` — `'use server'`, throw 패턴 (withErrorLogging 래퍼)
- **에러 처리**: `withErrorLogging()` 래퍼 → AppError(예상된 에러) / Unknown(Discord 로깅)
- **인증**: middleware.ts → Supabase Auth 쿠키 → `requireAuth()` 가드
- **검증**: Zod 스키마 (`src/lib/validations.ts`) — 모든 CUD 액션에 적용
- **상태**: useState/useMemo만 사용. 글로벌 상태 없음. 변경 후 `router.refresh()`
- **다크모드**: next-themes + CSS 변수 (`:root` / `.dark`) — 하드코딩 색상 금지
- **푸시 알림**: Service Worker + Web Push API (VAPID), 예약 리마인더

## 코드 규칙

- 한국어 UI (라벨, 메시지, 플레이스홀더 전부)
- 엔터키 폼 제출 방지 필수: `onSubmit={(e) => { e.preventDefault(); ... }}`
- 삭제는 Dialog 사용 (`confirm()` 금지)
- 금액: `AmountInput` 컴포넌트, 전화번호: 자동 포맷팅 + `inputMode="tel"`
- 아이콘 버튼: `aria-label` 필수
- 애니메이션: `transition-all` 금지 → 구체적 속성 명시 (`transition-colors` 등)
- 통계 데이터: DB 하드코딩 금지, 실시간 집계
- toast: `sonner` — `toast.success()` / `toast.error()`
- UI 컴포넌트: `@/components/ui/*` (shadcn/ui), 아이콘: `lucide-react`
- 에러: 예상된 에러는 `AppError`, 미지 에러는 `withErrorLogging()`으로 Discord 전송

## 디렉터리 구조

```
src/
├── app/(dashboard)/     # 라우트 그룹 (사이드바 레이아웃)
│   ├── page.tsx         # 대시보드
│   ├── sales/           # 매출
│   │   ├── sales-client.tsx       # 메인 컨테이너 (상태 관리)
│   │   └── components/            # SalesSummary, SalesTable, SaleFormDialog, SaleDetailDialog
│   ├── expenses/        # 지출
│   ├── customers/       # 고객
│   │   ├── customers-client.tsx   # 메인 컨테이너
│   │   └── components/            # CustomerCard, CustomerFormDialog, CustomerDetailDialog
│   ├── deposits/        # 입금 대조
│   ├── gallery/         # 사진첩
│   ├── calendar/        # 예약 캘린더
│   ├── statistics/      # 통계
│   ├── settings/        # 설정 (카드사 + 푸시 알림)
│   └── error.tsx        # 에러 바운더리
├── app/api/cron/        # Vercel Cron 라우트
│   ├── daily-reminder/  # 매일 08:00 KST 예약 요약 푸시
│   └── scheduled-reminders/ # 개별 예약 리마인더 푸시
├── app/login/           # 로그인
├── app/manifest.ts      # PWA 매니페스트
├── app/global-error.tsx # 글로벌 에러 바운더리
├── components/ui/       # shadcn/ui (25개)
├── components/layout/   # AppLayout, Header, Sidebar
├── components/sales/    # 매출 공통 (SalePhotoModal, SalesSettingsModal, CustomerAutocomplete)
├── components/gallery/  # 갤러리 관련 컴포넌트
├── components/expenses/ # 지출 관련 컴포넌트
├── components/error-boundary.tsx # React Error Boundary
├── lib/actions/         # Server Actions (15개, barrel: index.ts)
├── lib/constants.ts     # 공유 라벨 상수 (PAYMENT_LABELS, CHANNEL_LABELS, EXPENSE_LABELS)
├── lib/storage.ts       # Cloudflare R2 스토리지 추상화 (S3 호환)
├── lib/supabase/        # client.ts, server.ts, middleware.ts
├── lib/errors.ts        # AppError, ErrorCode, withErrorLogging()
├── lib/logger.ts        # reportError() → Discord 웹훅
├── lib/validations.ts   # Zod 스키마
├── lib/auth-guard.ts    # requireAuth()
├── lib/utils.ts         # cn(), formatPhoneNumber(), getMonthDateRange() 등
├── lib/export.ts        # ExportConfig<T> 제네릭, CSV/Excel/PDF 내보내기
├── types/database.ts    # 전체 타입 정의
└── public/
    ├── sw.js            # Service Worker (푸시 알림)
    └── icons/           # PWA 아이콘 (192/512, maskable)
```

## 비즈니스 로직

- 고객 식별: 전화번호 기준 (unique), 성별(male/female) 선택 가능
- 카드 수수료: `expected_deposit = amount * (1 - fee_rate/100)`
- 입금 예정일: 영업일 기준 N일
- 지출 총액: `unit_price * quantity`
- 사진: 3MB 초과 시 자동 압축, 카드당 최대 10장, Cloudflare R2 저장 (CDN 캐싱)
- 예약 리마인더: `reminder_at` 시간 설정 → Cron으로 푸시 알림 발송
- 푸시 실패: 영구 실패(404/410)만 구독 비활성화, 일시 에러는 유지

## 컬러 시스템

- **브랜드**: Warm Coral (`--brand: #E5614E`)
- **서브**: Sage Green (`--sage: #8B9D83`)
- **배지 패턴**: `backgroundColor: ${color}40`, `color: color`
- 상세 컬러는 `globals.css`의 CSS 변수 참조

## 기술 스택 상세

→ `docs/ARCHITECTURE.md` 참조~~

# Hazel Admin - 꽃집 관리 시스템

꽃집(헤이즐) 매출/지출/고객/사진첩/예약을 관리하는 어드민 웹앱.

## 핵심 패턴

```
page.tsx (Server) → 데이터 fetch → *-client.tsx (Client) → UI 렌더링
```

- **Server Actions**: `src/lib/actions/` — `'use server'`, `{ success, data?, error? }` 반환
- **인증**: middleware.ts → Supabase Auth 쿠키 → `requireAuth()` 가드
- **검증**: Zod 스키마 (`src/lib/validations.ts`) — 모든 CUD 액션에 적용
- **상태**: useState/useMemo만 사용. 글로벌 상태 없음. 변경 후 `router.refresh()`
- **다크모드**: next-themes + CSS 변수 (`:root` / `.dark`) — 하드코딩 색상 금지

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

## 디렉터리 구조

```
src/
├── app/(dashboard)/     # 라우트 그룹 (사이드바 레이아웃)
│   ├── page.tsx         # 대시보드
│   ├── sales/           # 매출
│   ├── expenses/        # 지출
│   ├── customers/       # 고객
│   ├── deposits/        # 입금 대조
│   ├── gallery/         # 사진첩
│   ├── calendar/        # 예약 캘린더
│   ├── statistics/      # 통계
│   └── settings/        # 설정
├── app/login/           # 로그인
├── components/ui/       # shadcn/ui (41개)
├── components/layout/   # AppLayout, Header, Sidebar
├── components/sales/    # 매출 관련 컴포넌트
├── components/gallery/  # 갤러리 관련 컴포넌트
├── components/expenses/ # 지출 관련 컴포넌트
├── lib/actions/         # Server Actions (14개)
├── lib/supabase/        # client.ts, server.ts, middleware.ts, storage.ts
├── lib/validations.ts   # Zod 스키마
├── lib/auth-guard.ts    # requireAuth()
├── lib/utils.ts         # cn(), formatPhoneNumber() 등
└── types/database.ts    # 전체 타입 정의
```

## 비즈니스 로직

- 고객 식별: 전화번호 기준 (unique)
- 카드 수수료: `expected_deposit = amount * (1 - fee_rate/100)`
- 입금 예정일: 영업일 기준 N일
- 지출 총액: `unit_price * quantity`
- 사진: 3MB 초과 시 자동 압축, 카드당 최대 10장

## 컬러 시스템

- **브랜드**: Warm Coral (`--brand: #E5614E`)
- **서브**: Sage Green (`--sage: #8B9D83`)
- **배지 패턴**: `backgroundColor: ${color}40`, `color: color`
- 상세 컬러는 `globals.css`의 CSS 변수 참조

## 기술 스택 상세

→ `docs/ARCHITECTURE.md` 참조

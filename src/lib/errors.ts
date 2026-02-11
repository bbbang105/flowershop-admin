import { reportError } from '@/lib/logger';

// ─── 에러 코드 ───────────────────────────────────────────────
export enum ErrorCode {
  VALIDATION = 'VALIDATION',
  NOT_FOUND = 'NOT_FOUND',
  DUPLICATE = 'DUPLICATE',
  UNAUTHORIZED = 'UNAUTHORIZED',
  DATABASE = 'DATABASE',
  STORAGE = 'STORAGE',
  UNKNOWN = 'UNKNOWN',
}

// ─── 앱 에러 (예상된 에러, Discord 전송 안 함) ────────────────
export class AppError extends Error {
  code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

// ─── Next.js 내부 에러 감지 (redirect, notFound, dynamic server usage 등) ─
function isNextInternalError(error: unknown): boolean {
  if (
    error &&
    typeof error === 'object' &&
    'digest' in error &&
    typeof (error as { digest: unknown }).digest === 'string'
  ) {
    const digest = (error as { digest: string }).digest;
    return (
      digest.startsWith('NEXT_') ||
      digest === 'DYNAMIC_SERVER_USAGE'
    );
  }
  return false;
}

// ─── Server Action 래퍼 ──────────────────────────────────────
export function withErrorLogging<TArgs extends unknown[], TResult>(
  actionName: string,
  fn: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    try {
      return await fn(...args);
    } catch (error: unknown) {
      // Next.js 내부 에러 (redirect, notFound) → 그대로 전파
      if (isNextInternalError(error)) {
        throw error;
      }

      // AppError (검증 실패, 비즈니스 룰) → 그대로 전파, Discord 안 감
      if (error instanceof AppError) {
        throw error;
      }

      // 예상치 못한 에러 → Discord 전송 + 일반 메시지로 교체
      await reportError(error, { action: actionName });
      throw new AppError(
        ErrorCode.UNKNOWN,
        '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      );
    }
  };
}

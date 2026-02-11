'use server';

// ─── 타입 ────────────────────────────────────────────────────
interface ErrorContext {
  action?: string;
  url?: string;
  userId?: string;
  extra?: Record<string, unknown>;
}

// ─── 중복 방지 (in-memory, 5분 TTL) ─────────────────────────
const recentErrors = new Map<string, number>();
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5분

function isDuplicate(key: string): boolean {
  const now = Date.now();
  const lastSent = recentErrors.get(key);
  if (lastSent && now - lastSent < DEDUP_WINDOW_MS) {
    return true;
  }
  recentErrors.set(key, now);

  // 오래된 항목 정리
  if (recentErrors.size > 50) {
    for (const [k, v] of recentErrors) {
      if (now - v > DEDUP_WINDOW_MS) recentErrors.delete(k);
    }
  }
  return false;
}

// ─── 스택 트레이스 새니타이징 ─────────────────────────────────
function sanitizeStack(stack: string): string {
  return stack
    .replace(/\/Users\/[^/]+/g, '/home/user')
    .replace(/[A-Za-z0-9_-]+@[A-Za-z0-9.-]+/g, '[EMAIL]')
    .replace(/token[:=]\s*['"]?[^\s'"]+/gi, 'token=[REDACTED]')
    .replace(/password[:=]\s*['"]?[^\s'"]+/gi, 'password=[REDACTED]')
    .replace(/key[:=]\s*['"]?[^\s'"]{20,}/gi, 'key=[REDACTED]')
    .split('\n')
    .slice(0, 20)
    .join('\n');
}

// ─── 문자열 잘라내기 ─────────────────────────────────────────
function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

// ─── 메인: 에러 리포팅 ──────────────────────────────────────
export async function reportError(
  error: unknown,
  context: ErrorContext = {},
): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  // 개발 환경이거나 웹훅 미설정 시 콘솔만
  if (process.env.NODE_ENV === 'development' || !webhookUrl) {
    console.error('[Error]', context.action || '', error);
    return;
  }

  const err = error instanceof Error ? error : new Error(String(error));
  const dedupKey = `${err.message}:${context.action || ''}`;

  if (isDuplicate(dedupKey)) return;

  const timestamp = new Date().toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
  });

  const embed = {
    title: '운영 오류 발생',
    color: 0xe5614e,
    fields: [
      {
        name: '오류 메시지',
        value: truncate(err.message, 256),
        inline: false,
      },
      {
        name: '액션',
        value: context.action || '(알 수 없음)',
        inline: true,
      },
      {
        name: '시간 (KST)',
        value: timestamp,
        inline: true,
      },
      ...(context.url
        ? [{ name: 'URL', value: context.url, inline: false }]
        : []),
      ...(err.stack
        ? [
            {
              name: '스택 트레이스',
              value: `\`\`\`\n${truncate(sanitizeStack(err.stack), 1000)}\n\`\`\``,
              inline: false,
            },
          ]
        : []),
    ],
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (webhookError) {
    console.error('[Logger] Discord 웹훅 전송 실패:', webhookError);
  }
}

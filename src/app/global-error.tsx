'use client';

import { useEffect, useRef } from 'react';
import { reportError } from '@/lib/logger';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const reported = useRef(false);

  useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    reportError(error, { action: 'global-error-boundary' });
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          fontFamily:
            'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            textAlign: 'center',
            backgroundColor: '#fafafa',
            color: '#171717',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              backgroundColor: '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              fontSize: 20,
              color: '#E5614E',
              fontWeight: 700,
            }}
          >
            !
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
            시스템 오류가 발생했습니다
          </h2>
          <p
            style={{
              fontSize: 14,
              color: '#6b7280',
              marginBottom: 16,
              maxWidth: 320,
            }}
          >
            페이지를 새로고침하거나 잠시 후 다시 시도해 주세요.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              backgroundColor: '#E5614E',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}

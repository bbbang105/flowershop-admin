'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { reportError } from '@/lib/logger';

export default function Error({
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
    reportError(error, { action: 'dashboard-error-boundary' });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="w-5 h-5 text-destructive" />
      </div>
      <h2 className="text-base font-semibold text-foreground mb-1">오류가 발생했습니다</h2>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.
      </p>
      <Button onClick={reset}>다시 시도</Button>
    </div>
  );
}

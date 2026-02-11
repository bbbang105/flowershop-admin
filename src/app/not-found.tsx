import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-20 text-center">
      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
        <FileQuestion className="w-5 h-5 text-muted-foreground" />
      </div>
      <h2 className="text-base font-semibold text-foreground mb-1">
        페이지를 찾을 수 없습니다
      </h2>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
      </p>
      <Button asChild>
        <Link href="/">대시보드로 돌아가기</Link>
      </Button>
    </div>
  );
}

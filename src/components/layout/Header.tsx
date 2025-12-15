'use client';

import { Menu, Bell, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface HeaderProps {
  onMenuClick: () => void;
}

const pageTitles: Record<string, string> = {
  '/': '대시보드',
  '/sales': '매출 관리',
  '/expenses': '지출 관리',
  '/customers': '고객 관리',
  '/deposits': '입금 대조',
  '/statistics': '통계',
  '/settings': '설정',
};

function getPageTitle(pathname: string): string {
  // 정확히 일치하는 경우
  if (pageTitles[pathname]) {
    return pageTitles[pathname];
  }
  // 하위 경로인 경우 (예: /customers/123)
  for (const [path, title] of Object.entries(pageTitles)) {
    if (path !== '/' && pathname.startsWith(path)) {
      return title;
    }
  }
  return '헤이즐 어드민';
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-gray-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex h-full items-center justify-between px-4 lg:px-6">
        {/* Left side: Menu button + Page title */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden shrink-0"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-gray-900 truncate">
            {pageTitle}
          </h1>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700">
            <Bell className="h-5 w-5" />
          </Button>
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  X,
  Flower2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/', icon: LayoutDashboard, label: '대시보드' },
  { href: '/sales', icon: Receipt, label: '매출관리' },
  { href: '/expenses', icon: Wallet, label: '지출관리' },
  { href: '/customers', icon: Users, label: '고객관리' },
  { href: '/deposits', icon: CreditCard, label: '입금대조' },
  { href: '/statistics', icon: BarChart3, label: '통계' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-full w-64 bg-white border-r border-gray-100 transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-gray-100">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center">
                <Flower2 className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">Hazel Admin</span>
            </Link>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>


          {/* Navigation */}
          <nav className="flex-1 py-6 px-3 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-rose-50 text-rose-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <item.icon className={cn('h-5 w-5', isActive && 'text-rose-500')} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Settings */}
          <div className="border-t border-gray-100 py-4 px-3">
            <Link
              href="/settings"
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                pathname === '/settings'
                  ? 'bg-rose-50 text-rose-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Settings className={cn('h-5 w-5', pathname === '/settings' && 'text-rose-500')} />
              설정
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}

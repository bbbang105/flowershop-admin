'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  Receipt,
  Wallet,
  Users,
  CreditCard,
  Settings,
  X,
  Flower2,
  Image,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
} from 'lucide-react';
import { signOut } from '@/lib/actions/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const dashboardItem: NavItem = { href: '/', icon: LayoutDashboard, label: '대시보드' };

const navSections: NavSection[] = [
  {
    title: '매장 운영',
    items: [
      { href: '/calendar', icon: CalendarDays, label: '캘린더' },
      { href: '/sales', icon: Receipt, label: '매출관리' },
      { href: '/expenses', icon: Wallet, label: '지출관리' },
      { href: '/deposits', icon: CreditCard, label: '입금대조' },
    ],
  },
  {
    title: '고객 기록',
    items: [
      { href: '/customers', icon: Users, label: '고객관리' },
      { href: '/gallery', icon: Image, label: '사진첩' },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

function NavLink({
  href,
  icon: Icon,
  label,
  isActive,
  isCollapsed,
  onClick,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
  onClick?: () => void;
}) {
  const link = (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-3 rounded-lg text-[13px] font-medium transition-colors',
        isCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2',
        isActive
          ? 'bg-accent text-foreground font-semibold'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      {/* Active indicator bar */}
      {isActive && (
        <span className={cn(
          'absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-brand',
          isCollapsed ? 'h-4' : 'h-5'
        )} />
      )}
      <Icon className="h-4 w-4 shrink-0" />
      {!isCollapsed && <span>{label}</span>}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

export function Sidebar({ isOpen, isCollapsed, onClose, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-full border-r border-sidebar-border bg-sidebar transition-all duration-200 ease-in-out',
          isCollapsed ? 'w-16' : 'w-60',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className={cn(
            'h-14 flex items-center border-b border-sidebar-border shrink-0',
            isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          )}>
            <Link href="/" className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center shrink-0">
                <Flower2 className="h-4.5 w-4.5 text-brand-foreground" />
              </div>
              {!isCollapsed && (
                <span className="text-base font-bold text-foreground truncate">Hazel</span>
              )}
            </Link>
            <Button variant="ghost" size="icon-sm" className="lg:hidden shrink-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            {/* Dashboard (standalone) */}
            <div className={cn('mb-3', isCollapsed ? 'px-2' : 'px-3')}>
              <NavLink
                href={dashboardItem.href}
                icon={dashboardItem.icon}
                label={dashboardItem.label}
                isActive={pathname === '/'}
                isCollapsed={isCollapsed}
                onClick={onClose}
              />
            </div>

            {navSections.map((section, idx) => (
              <div key={section.title} className={cn(idx > 0 && 'mt-4')}>
                {/* Section title */}
                {!isCollapsed && (
                  <div className="px-4 mb-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                      {section.title}
                    </span>
                  </div>
                )}
                {isCollapsed && idx > 0 && (
                  <div className="mx-3 mb-2 border-t border-sidebar-border" />
                )}

                {/* Items */}
                <div className={cn('space-y-0.5', isCollapsed ? 'px-2' : 'px-3')}>
                  {section.items.map((item) => {
                    const isActive = pathname === item.href ||
                      (item.href !== '/' && pathname.startsWith(item.href));
                    return (
                      <NavLink
                        key={item.href}
                        href={item.href}
                        icon={item.icon}
                        label={item.label}
                        isActive={isActive}
                        isCollapsed={isCollapsed}
                        onClick={onClose}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Bottom section */}
          <div className={cn('border-t border-sidebar-border py-3', isCollapsed ? 'px-2' : 'px-3')}>
            <NavLink
              href="/settings"
              icon={Settings}
              label="설정"
              isActive={pathname === '/settings'}
              isCollapsed={isCollapsed}
              onClick={onClose}
            />

            {/* Logout */}
            {isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => signOut()}
                    className="flex items-center justify-center rounded-lg text-[13px] font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors w-full mt-1 px-2 py-2.5"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  로그아웃
                </TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={() => signOut()}
                className="flex items-center gap-3 rounded-lg text-[13px] font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors w-full mt-1 px-3 py-2"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>로그아웃</span>
              </button>
            )}

            {/* Collapse toggle (desktop only) */}
            <button
              onClick={onToggleCollapse}
              className={cn(
                'hidden lg:flex items-center gap-3 rounded-lg text-[13px] font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors w-full mt-1',
                isCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2'
              )}
            >
              {isCollapsed ? (
                <ChevronsRight className="h-4 w-4 shrink-0" />
              ) : (
                <>
                  <ChevronsLeft className="h-4 w-4 shrink-0" />
                  <span>접기</span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

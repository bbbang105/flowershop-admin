'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ResponsiveTableProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveTableRowProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  mobileCard?: React.ReactNode;
}

interface ResponsiveTableCellProps {
  children: React.ReactNode;
  className?: string;
  label?: string;
  hideOnMobile?: boolean;
}

// Context to pass mobile mode to children
const ResponsiveTableContext = React.createContext<{ isMobileView: boolean }>({ isMobileView: false });

export function ResponsiveTable({ children, className }: ResponsiveTableProps) {
  return (
    <div className={cn('w-full', className)}>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          {children}
        </table>
      </div>
      {/* Mobile Cards */}
      <ResponsiveTableContext.Provider value={{ isMobileView: true }}>
        <div className="md:hidden space-y-3">
          {children}
        </div>
      </ResponsiveTableContext.Provider>
    </div>
  );
}

export function ResponsiveTableHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <thead className={cn('[&_tr]:border-b hidden md:table-header-group', className)}>
      {children}
    </thead>
  );
}

export function ResponsiveTableBody({ children, className }: { children: React.ReactNode; className?: string }) {
  const { isMobileView } = React.useContext(ResponsiveTableContext);
  
  if (isMobileView) {
    return <>{children}</>;
  }
  
  return (
    <tbody className={cn('[&_tr:last-child]:border-0', className)}>
      {children}
    </tbody>
  );
}

export function ResponsiveTableHead({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn(
      'text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap',
      className
    )}>
      {children}
    </th>
  );
}

export function ResponsiveTableRow({ children, className, onClick, mobileCard }: ResponsiveTableRowProps) {
  const { isMobileView } = React.useContext(ResponsiveTableContext);
  
  if (isMobileView) {
    if (mobileCard) {
      return (
        <div 
          className={cn(
            'bg-white border rounded-lg p-4 shadow-sm',
            onClick && 'cursor-pointer hover:bg-gray-50 active:bg-gray-100',
            className
          )}
          onClick={onClick}
        >
          {mobileCard}
        </div>
      );
    }
    return null;
  }
  
  return (
    <tr 
      className={cn(
        'hover:bg-muted/50 border-b transition-colors',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function ResponsiveTableCell({ children, className, label, hideOnMobile }: ResponsiveTableCellProps) {
  return (
    <td className={cn(
      'p-2 align-middle whitespace-nowrap',
      hideOnMobile && 'hidden lg:table-cell',
      className
    )}>
      {children}
    </td>
  );
}

// Mobile card helper components
export function MobileCardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between mb-2', className)}>
      {children}
    </div>
  );
}

export function MobileCardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('font-medium text-gray-900', className)}>
      {children}
    </span>
  );
}

export function MobileCardBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600', className)}>
      {children}
    </span>
  );
}

export function MobileCardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1 text-sm', className)}>
      {children}
    </div>
  );
}

export function MobileCardRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex justify-between items-center', className)}>
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}

export function MobileCardActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex justify-end gap-2 mt-3 pt-3 border-t', className)}>
      {children}
    </div>
  );
}

// Empty state component
export function ResponsiveTableEmpty({ colSpan, message }: { colSpan: number; message: string }) {
  const { isMobileView } = React.useContext(ResponsiveTableContext);
  
  if (isMobileView) {
    return (
      <div className="text-center py-12 text-gray-500 bg-white border rounded-lg">
        {message}
      </div>
    );
  }
  
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-12 text-gray-500">
        {message}
      </td>
    </tr>
  );
}

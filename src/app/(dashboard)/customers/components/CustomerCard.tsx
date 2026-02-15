'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import type { Customer } from '@/types/database';

export const gradeLabels: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  new: { label: '신규', icon: '', color: 'text-muted-foreground', bg: 'bg-muted' },
  regular: { label: '단골', icon: '🌟', color: 'text-yellow-600', bg: 'bg-muted' },
  vip: { label: 'VIP', icon: '👑', color: 'text-purple-600', bg: 'bg-purple-50' },
  blacklist: { label: '블랙', icon: '⚠️', color: 'text-red-600', bg: 'bg-red-50' },
};

export const genderLabels: Record<string, string> = { male: '남', female: '여' };

export function GenderBadge({ gender, size = 'sm' }: { gender: string | null | undefined; size?: 'sm' | 'md' }) {
  if (!gender) return null;
  const base = size === 'md' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-0.5 text-[10px]';
  if (gender === 'male') {
    return <span className={`${base} font-medium rounded bg-blue-500/10 text-blue-600 shrink-0`} aria-label="남성">{genderLabels.male}</span>;
  }
  if (gender === 'female') {
    return <span className={`${base} font-medium rounded bg-pink-500/10 text-pink-600 shrink-0`} aria-label="여성">{genderLabels.female}</span>;
  }
  return null;
}

interface CustomerCardProps {
  customer: Customer;
  onSelect: (customer: Customer) => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
}

export function CustomerCard({ customer, onSelect, onEdit, onDelete }: CustomerCardProps) {
  const grade = gradeLabels[customer.grade];

  return (
    <Card
      className="group cursor-pointer hover:bg-muted/30 active:bg-muted active:scale-[0.99] transition-colors touch-manipulation"
      onClick={() => onSelect(customer)}
    >
      <CardContent className="p-4">
        {/* Top: name + grade + gender + actions */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 bg-muted rounded-full flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-muted-foreground">
                {customer.name.charAt(0)}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-foreground text-sm truncate">{customer.name}</span>
                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${grade.bg} ${grade.color} shrink-0`}>
                  {grade.icon} {grade.label}
                </span>
                <GenderBadge gender={customer.gender} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{customer.phone}</p>
            </div>
          </div>
          <div className="flex gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); onEdit(customer); }}
              aria-label={`${customer.name} 수정`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(customer); }}
              aria-label={`${customer.name} 삭제`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
          <div>
            <p className="text-[10px] text-muted-foreground">구매</p>
            <p className="text-sm font-semibold text-foreground tabular-nums">{customer.total_purchase_count}회</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">총액</p>
            <p className="text-sm font-semibold text-brand tabular-nums">{formatCurrency(customer.total_purchase_amount)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">최근</p>
            <p className="text-sm font-medium text-foreground tabular-nums">
              {customer.last_purchase_date ? format(new Date(customer.last_purchase_date), 'M/d', { locale: ko }) : '-'}
            </p>
          </div>
        </div>

        {/* Note preview */}
        {customer.note && (
          <p className="text-xs text-muted-foreground mt-2 truncate" title={customer.note}>
            {customer.note}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

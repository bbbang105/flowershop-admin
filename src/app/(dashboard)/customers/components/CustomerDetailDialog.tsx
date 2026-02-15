'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Phone, ShoppingBag, ExternalLink, TrendingUp, Users, Pencil, Trash2, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import type { Customer, Sale } from '@/types/database';
import { gradeLabels, GenderBadge } from './CustomerCard';

interface CustomerDetailDialogProps {
  customer: Customer | null;
  sales: Sale[];
  isLoadingSales: boolean;
  categoryLabels: Record<string, string>;
  categoryColors: Record<string, string>;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  onSaleRegister: (customer: Customer) => void;
}

export function CustomerDetailDialog({
  customer,
  sales,
  isLoadingSales,
  categoryLabels,
  categoryColors,
  onClose,
  onEdit,
  onDelete,
  onSaleRegister,
}: CustomerDetailDialogProps) {
  const router = useRouter();

  return (
    <Dialog open={!!customer} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">고객 상세</DialogTitle>
        </DialogHeader>
        {customer && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-lg text-foreground">{customer.name}</span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${gradeLabels[customer.grade].bg} ${gradeLabels[customer.grade].color}`}>
                    {gradeLabels[customer.grade].icon} {gradeLabels[customer.grade].label}
                  </span>
                  <GenderBadge gender={customer.gender} size="md" />
                </div>
                <a href={`tel:${customer.phone.replace(/-/g, '')}`} className="flex items-center gap-1 text-muted-foreground text-sm hover:text-brand transition-colors">
                  <Phone className="w-3 h-3" />
                  <span>{customer.phone}</span>
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">구매 횟수</p>
                <p className="text-xl font-bold text-foreground tabular-nums">{customer.total_purchase_count}회</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">총 구매액</p>
                <p className="text-xl font-bold text-brand tabular-nums">{formatCurrency(customer.total_purchase_amount)}</p>
              </div>
            </div>

            {customer.first_purchase_date && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">첫 구매</p>
                  <p className="font-medium">{format(new Date(customer.first_purchase_date), 'yyyy.M.d', { locale: ko })}</p>
                </div>
                {customer.last_purchase_date && (
                  <div>
                    <p className="text-muted-foreground">최근 구매</p>
                    <p className="font-medium">{format(new Date(customer.last_purchase_date), 'yyyy.M.d', { locale: ko })}</p>
                  </div>
                )}
              </div>
            )}

            {customer.note && (
              <div className="space-y-1 pt-2 border-t">
                <p className="text-sm text-muted-foreground">메모</p>
                <p className="text-foreground">{customer.note}</p>
              </div>
            )}

            {/* Purchase History */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">구매 이력</p>
              </div>
              {isLoadingSales ? (
                <div className="space-y-2 py-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-muted rounded">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-3.5 w-8" />
                        <Skeleton className="h-5 w-16 rounded" />
                      </div>
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              ) : sales.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {sales.slice(0, 5).map((sale) => (
                    <div
                      key={sale.id}
                      className="flex justify-between items-center text-sm p-2 bg-muted rounded"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{format(new Date(sale.date), 'M/d', { locale: ko })}</span>
                        <span
                          className="px-1.5 py-0.5 text-xs font-medium rounded"
                          style={{
                            backgroundColor: categoryColors[sale.product_category] ? `${categoryColors[sale.product_category]}40` : '#f3f4f6',
                            color: categoryColors[sale.product_category] || '#374151'
                          }}
                        >
                          {categoryLabels[sale.product_category] || sale.product_category || sale.product_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatCurrency(sale.amount)}</span>
                        <button
                          type="button"
                          className="text-brand hover:text-brand p-1"
                          onClick={() => {
                            const saleDate = new Date(sale.date);
                            const year = saleDate.getFullYear();
                            const month = saleDate.getMonth() + 1;
                            router.push(`/sales?year=${year}&month=${month}&saleId=${sale.id}`);
                          }}
                          title="매출 상세 보기"
                          aria-label="매출 상세 보기"
                        >
                          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {sales.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">외 {sales.length - 5}건</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5 py-4 text-center">
                  <TrendingUp className="w-5 h-5 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">아직 구매 이력이 없습니다</p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 pt-4 border-t">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => onSaleRegister(customer)}
                >
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  매출 등록
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    onClose();
                    router.push(`/gallery?customer=${customer.id}`);
                  }}
                >
                  <ImageIcon className="w-4 h-4 mr-2" />
                  사진 보기
                </Button>
                <Button variant="outline" onClick={() => onEdit(customer)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  수정
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive hover:bg-red-50"
                  onClick={() => onDelete(customer)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  삭제
                </Button>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={onClose}>
                  닫기
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

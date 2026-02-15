'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ImageIcon, ChevronRight, Pencil, Trash2, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { CHANNEL_LABELS } from '@/lib/constants';
import type { Sale } from '@/types/database';

interface SalesTableProps {
  sales: Sale[];
  categoryLabels: Record<string, string>;
  categoryColors: Record<string, string>;
  paymentLabels: Record<string, string>;
  paymentColors: Record<string, string>;
  hasActiveFilters: boolean;
  onSelectSale: (sale: Sale) => void;
  onEditSale: (sale: Sale) => void;
  onDeleteSale: (sale: Sale) => void;
  onPhotoModal: (sale: Sale) => void;
  onResetFilters: () => void;
  onOpenForm: () => void;
}

export function SalesTable({
  sales,
  categoryLabels,
  categoryColors,
  paymentLabels,
  paymentColors,
  hasActiveFilters,
  onSelectSale,
  onEditSale,
  onDeleteSale,
  onPhotoModal,
  onResetFilters,
  onOpenForm,
}: SalesTableProps) {
  return (
    <>
      {/* Desktop Table */}
      <Card className="overflow-hidden hidden md:block">
        <CardContent className="p-0">
          <Table>
            <caption className="sr-only">매출 내역 목록</caption>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[120px] pl-6">날짜</TableHead>
                <TableHead className="w-[140px]">카테고리</TableHead>
                <TableHead className="w-[120px]">금액</TableHead>
                <TableHead className="w-[100px]">결제</TableHead>
                <TableHead className="w-[100px] hidden lg:table-cell">예약</TableHead>
                <TableHead className="w-[100px] hidden lg:table-cell">고객</TableHead>
                <TableHead className="hidden xl:table-cell">비고</TableHead>
                <TableHead className="w-[130px] text-right pr-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                    {hasActiveFilters ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                          <Search className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p>선택한 필터에 맞는 매출이 없습니다</p>
                        <Button variant="outline" size="sm" onClick={onResetFilters}>
                          필터 초기화
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                          <TrendingUp className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p>등록된 매출이 없습니다</p>
                        <Button variant="outline" size="sm" onClick={onOpenForm}>
                          첫 매출 등록하기
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                sales.map((sale) => (
                  <TableRow
                    key={sale.id}
                    className="cursor-pointer hover:bg-muted/50 active:bg-muted transition-colors"
                    onClick={() => onSelectSale(sale)}
                  >
                    <TableCell className="text-muted-foreground pl-6">{format(new Date(sale.date), 'M/d (E)', { locale: ko })}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2 py-1 text-xs font-medium rounded-md"
                          style={{
                            backgroundColor: categoryColors[sale.product_category] ? `${categoryColors[sale.product_category]}40` : '#f3f4f6',
                            color: categoryColors[sale.product_category] || '#374151'
                          }}
                        >
                          {categoryLabels[sale.product_category] || sale.product_category || sale.product_name}
                        </span>
                        {sale.photos && sale.photos.length > 0 && (
                          <ImageIcon className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">{formatCurrency(sale.amount)}</TableCell>
                    <TableCell>
                      <span
                        className="px-2 py-1 text-xs font-medium rounded-md"
                        style={{
                          backgroundColor: paymentColors[sale.payment_method] ? `${paymentColors[sale.payment_method]}40` : '#f3f4f6',
                          color: paymentColors[sale.payment_method] || '#374151'
                        }}
                      >
                        {paymentLabels[sale.payment_method] || sale.payment_method}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground truncate">{CHANNEL_LABELS[sale.reservation_channel]}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground truncate">{sale.customer_name || '-'}</TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground text-sm truncate" title={sale.note || ''}>
                      {sale.note || '-'}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-brand"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPhotoModal(sale);
                          }}
                          aria-label="사진 관리"
                        >
                          <ImageIcon className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditSale(sale);
                          }}
                          aria-label="수정"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSale(sale);
                          }}
                          aria-label="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {sales.length === 0 ? (
          <Card className="p-8 text-center">
            {hasActiveFilters ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Search className="w-8 h-8 text-muted-foreground opacity-40" />
                <p className="text-sm">선택한 필터에 맞는 매출이 없습니다</p>
                <Button variant="outline" size="sm" onClick={onResetFilters}>
                  필터 초기화
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-muted-foreground" />
                </div>
                <p>등록된 매출이 없습니다</p>
              </div>
            )}
          </Card>
        ) : (
          sales.map((sale) => (
            <Card
              key={sale.id}
              className="p-4 cursor-pointer hover:bg-muted/30 active:bg-muted active:scale-[0.99] transition-colors touch-manipulation"
              onClick={() => onSelectSale(sale)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="px-2 py-0.5 text-xs font-medium rounded flex-shrink-0"
                      style={{
                        backgroundColor: categoryColors[sale.product_category] ? `${categoryColors[sale.product_category]}40` : '#f3f4f6',
                        color: categoryColors[sale.product_category] || '#374151'
                      }}
                    >
                      {categoryLabels[sale.product_category] || sale.product_category || sale.product_name}
                    </span>
                    {sale.photos && sale.photos.length > 0 && (
                      <ImageIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="text-muted-foreground flex-shrink-0">{format(new Date(sale.date), 'M/d')}</span>
                    <span
                      className="px-2 py-0.5 text-xs font-medium rounded flex-shrink-0"
                      style={{
                        backgroundColor: paymentColors[sale.payment_method] ? `${paymentColors[sale.payment_method]}40` : '#f3f4f6',
                        color: paymentColors[sale.payment_method] || '#374151'
                      }}
                    >
                      {paymentLabels[sale.payment_method] || sale.payment_method}
                    </span>
                    {sale.customer_name && (
                      <span className="text-muted-foreground truncate max-w-[80px]">{sale.customer_name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-bold text-foreground whitespace-nowrap">{formatCurrency(sale.amount)}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </>
  );
}

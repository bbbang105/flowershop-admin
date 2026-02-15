'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImageIcon, Pencil, Trash2, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { CHANNEL_LABELS } from '@/lib/constants';
import type { Sale, PhotoCard } from '@/types/database';

interface SaleDetailDialogProps {
  sale: Sale | null;
  photos: PhotoCard | null;
  categoryLabels: Record<string, string>;
  categoryColors: Record<string, string>;
  paymentLabels: Record<string, string>;
  paymentColors: Record<string, string>;
  onClose: () => void;
  onEdit: (sale: Sale) => void;
  onDelete: (sale: Sale) => void;
  onPhotoModal: (sale: Sale) => void;
}

export function SaleDetailDialog({
  sale,
  photos,
  categoryLabels,
  categoryColors,
  paymentLabels,
  paymentColors,
  onClose,
  onEdit,
  onDelete,
  onPhotoModal,
}: SaleDetailDialogProps) {
  const router = useRouter();

  return (
    <Dialog open={!!sale} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">매출 상세</DialogTitle>
        </DialogHeader>
        {sale && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">날짜</p>
                <p className="font-medium">{format(new Date(sale.date), 'yyyy년 M월 d일', { locale: ko })}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">금액</p>
                <p className="font-bold text-lg text-brand">{formatCurrency(sale.amount)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">카테고리</p>
                <span
                  className="inline-block px-2 py-1 text-xs font-medium rounded-md"
                  style={{
                    backgroundColor: categoryColors[sale.product_category] ? `${categoryColors[sale.product_category]}40` : '#f3f4f6',
                    color: categoryColors[sale.product_category] || '#374151'
                  }}
                >
                  {categoryLabels[sale.product_category] || sale.product_category || sale.product_name}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">결제방식</p>
                <span
                  className="inline-block px-2 py-1 text-xs font-medium rounded-md"
                  style={{
                    backgroundColor: paymentColors[sale.payment_method] ? `${paymentColors[sale.payment_method]}40` : '#f3f4f6',
                    color: paymentColors[sale.payment_method] || '#374151'
                  }}
                >
                  {paymentLabels[sale.payment_method] || sale.payment_method}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">예약방식</p>
                <p className="font-medium">{CHANNEL_LABELS[sale.reservation_channel]}</p>
              </div>
              {sale.customer_name && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">고객명</p>
                  {sale.customer_id ? (
                    <button
                      type="button"
                      className="flex items-center gap-1 font-medium text-brand hover:text-brand/80 transition-colors"
                      onClick={() => {
                        onClose();
                        router.push(`/customers?customerId=${sale.customer_id}`);
                      }}
                      aria-label={`${sale.customer_name} 고객 상세 보기`}
                    >
                      <span>{sale.customer_name}</span>
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  ) : (
                    <p className="font-medium">{sale.customer_name}</p>
                  )}
                </div>
              )}
            </div>

            {sale.customer_phone && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">연락처</p>
                <p className="font-medium">{sale.customer_phone}</p>
              </div>
            )}

            {sale.note && (
              <div className="space-y-1 pt-2 border-t">
                <p className="text-sm text-muted-foreground">비고</p>
                <p className="text-foreground">{sale.note}</p>
              </div>
            )}

            {photos && photos.photos.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-sm text-muted-foreground">사진</p>
                <div className="grid grid-cols-3 gap-2">
                  {photos.photos.slice(0, 6).map((photo, index) => (
                    <div key={photo.url} className="relative aspect-square">
                      <Image
                        src={photo.url}
                        alt={`사진 ${index + 1}`}
                        fill
                        sizes="(max-width: 768px) 33vw, 128px"
                        className="object-cover rounded-lg"
                      />
                      {index === 5 && photos.photos.length > 6 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                          <span className="text-white font-medium">+{photos.photos.length - 6}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4 border-t">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    onPhotoModal(sale);
                    onClose();
                  }}
                >
                  <ImageIcon className="w-4 h-4 mr-2" />
                  사진
                </Button>
                <Button variant="outline" onClick={() => onEdit(sale)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  수정
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onDelete(sale)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  삭제
                </Button>
              </div>
              <Button variant="outline" onClick={onClose}>
                닫기
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

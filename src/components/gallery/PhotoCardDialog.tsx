'use client';

import { useState } from 'react';
import { PhotoCard } from '@/types/database';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Edit, Trash2, Loader2, Download, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { deletePhotoCard, deletePhotosFromStorage, downloadPhoto, downloadAllPhotos } from '@/lib/actions/photo-cards';

interface PhotoCardDialogProps {
  card: PhotoCard | null;
  onClose: () => void;
  onEdit: (card: PhotoCard) => void;
  onDelete: () => void;
}

export function PhotoCardDialog({ card, onClose, onEdit, onDelete }: PhotoCardDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!card) return null;

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : card.photos.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < card.photos.length - 1 ? prev + 1 : 0));
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const photoUrls = await deletePhotoCard(card.id);
      await deletePhotosFromStorage(photoUrls);
      toast.success('카드가 삭제되었습니다');
      onDelete();
      onClose();
    } catch (error) {
      toast.error('삭제에 실패했습니다');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const downloadBlob = async (url: string, filename: string) => {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };

  const handleDownloadCurrent = async () => {
    if (!card.photos[currentIndex]) return;

    setIsDownloading(true);
    try {
      const result = await downloadPhoto(card.photos[currentIndex]);
      if (result) {
        await downloadBlob(result.url, result.filename);
        toast.success('다운로드 완료');
      }
    } catch (error) {
      toast.error('다운로드에 실패했습니다');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadAll = async () => {
    setIsDownloading(true);
    try {
      const { urls } = await downloadAllPhotos(card.id);
      for (const item of urls) {
        await downloadBlob(item.url, item.filename);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      toast.success(`${urls.length}개 사진 다운로드 완료`);
    } catch (error) {
      toast.error('다운로드에 실패했습니다');
    } finally {
      setIsDownloading(false);
    }
  };


  const createdDate = format(new Date(card.created_at), 'yyyy년 MM월 dd일 HH:mm', { locale: ko });
  const updatedDate = format(new Date(card.updated_at), 'yyyy년 MM월 dd일 HH:mm', { locale: ko });
  const isUpdated = card.created_at !== card.updated_at;

  return (
    <Dialog open={!!card} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{card.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {card.photos.length > 0 && (
            <div className="relative">
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                <Image
                  src={card.photos[currentIndex].url}
                  alt={`${card.title} - ${currentIndex + 1}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 768px"
                  className="object-contain"
                  priority={currentIndex === 0}
                />
              </div>

              {card.photos.length > 1 && (
                <>
                  <button
                    onClick={handlePrev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleNext}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-sm px-3 py-1 rounded-full">
                    {currentIndex + 1} / {card.photos.length}
                  </div>
                </>
              )}
            </div>
          )}

          {card.photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {card.photos.map((photo, index) => (
                <button
                  key={photo.url}
                  onClick={() => setCurrentIndex(index)}
                  className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${
                    index === currentIndex ? 'border-brand' : 'border-transparent'
                  }`}
                >
                  <Image
                    src={photo.url}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>생성: {createdDate}</p>
              {isUpdated && <p>수정: {updatedDate}</p>}
            </div>

            {card.description && (
              <p className="text-foreground">{card.description}</p>
            )}

            {card.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {card.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="bg-muted">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {card.sale_id && (
              <Link
                href={`/sales?highlight=${card.sale_id}`}
                className="inline-flex items-center gap-1.5 text-sm text-brand hover:text-brand hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                연결된 매출 보기
              </Link>
            )}
          </div>

          {showDeleteConfirm ? (
            <div className="flex items-center justify-between p-4 bg-destructive/10 rounded-lg">
              <p className="text-sm text-destructive">정말 삭제하시겠습니까?</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  취소
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  삭제
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-2 pt-4 border-t">
              {card.photos.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleDownloadCurrent}
                    disabled={isDownloading}
                  >
                    {isDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                    현재 사진
                  </Button>
                  {card.photos.length > 1 && (
                    <Button
                      variant="outline"
                      onClick={handleDownloadAll}
                      disabled={isDownloading}
                    >
                      {isDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                      전체 ({card.photos.length})
                    </Button>
                  )}
                </>
              )}
              <Button variant="outline" onClick={() => onEdit(card)}>
                <Edit className="w-4 h-4 mr-2" />
                수정
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                삭제
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

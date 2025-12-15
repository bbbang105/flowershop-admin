'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X, Loader2, ImageIcon } from 'lucide-react';
import Image from 'next/image';

interface PhotoUploadProps {
  saleId?: string;
  photos: string[];
  onUpload: (files: FileList) => Promise<void>;
  onDelete: (photoUrl: string) => Promise<void>;
  disabled?: boolean;
}

export function PhotoUpload({ saleId, photos, onUpload, onDelete, disabled }: PhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      await onUpload(files);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (photoUrl: string) => {
    setDeletingUrl(photoUrl);
    try {
      await onDelete(photoUrl);
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setDeletingUrl(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">상품 사진</label>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || !saleId}
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Camera className="w-4 h-4 mr-1" />
            )}
            {isUploading ? '업로드 중...' : '사진 추가'}
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {!saleId && !disabled && (
        <p className="text-xs text-muted-foreground">
          매출을 먼저 저장한 후 사진을 추가할 수 있습니다.
        </p>
      )}

      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url, index) => (
            <div key={url} className="relative group aspect-square">
              <Image
                src={url}
                alt={`상품 사진 ${index + 1}`}
                fill
                className="object-cover rounded-md"
                sizes="(max-width: 768px) 33vw, 100px"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleDelete(url)}
                  disabled={deletingUrl === url}
                  className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {deletingUrl === url ? (
                    <Loader2 className="w-3 h-3 text-white animate-spin" />
                  ) : (
                    <X className="w-3 h-3 text-white" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-20 border-2 border-dashed rounded-md text-muted-foreground">
          <div className="flex flex-col items-center gap-1">
            <ImageIcon className="w-6 h-6" />
            <span className="text-xs">사진 없음</span>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useCallback } from 'react';
import { PhotoFile } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { X, Upload, Loader2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE_MB = 3;
const MAX_PHOTOS = 10;

const COMPRESSION_OPTIONS = {
  maxSizeMB: MAX_FILE_SIZE_MB,
  maxWidthOrHeight: 2560,
  useWebWorker: true,
};

type PhotoItem = 
  | { type: 'existing'; photo: PhotoFile }
  | { type: 'new'; file: File; preview: string };

interface SalePhotoUploadProps {
  photoItems: PhotoItem[];
  onChange: (items: PhotoItem[]) => void;
  disabled?: boolean;
}

export function SalePhotoUpload({ photoItems, onChange, disabled }: SalePhotoUploadProps) {
  const [isCompressing, setIsCompressing] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const addFiles = useCallback(async (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const totalCount = photoItems.length + imageFiles.length;
    
    if (totalCount > MAX_PHOTOS) {
      toast.error(`사진은 최대 ${MAX_PHOTOS}장까지 등록할 수 있습니다`);
      return;
    }

    setIsCompressing(true);
    try {
      const newItems: PhotoItem[] = [];
      
      for (const file of imageFiles) {
        let processedFile = file;
        
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          processedFile = await imageCompression(file, COMPRESSION_OPTIONS);
        }
        
        newItems.push({
          type: 'new',
          file: new File([processedFile], file.name, { type: processedFile.type }),
          preview: URL.createObjectURL(processedFile),
        });
      }
      
      onChange([...photoItems, ...newItems]);
    } catch {
      toast.error('이미지 처리 중 오류가 발생했습니다');
    } finally {
      setIsCompressing(false);
    }
  }, [photoItems, onChange]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await addFiles(Array.from(e.target.files || []));
    e.target.value = '';
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    await addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles, disabled]);

  const removePhoto = (index: number) => {
    const item = photoItems[index];
    if (item.type === 'new') URL.revokeObjectURL(item.preview);
    onChange(photoItems.filter((_, i) => i !== index));
  };

  const handlePhotoDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handlePhotoDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handlePhotoDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newItems = [...photoItems];
      const [removed] = newItems.splice(draggedIndex, 1);
      newItems.splice(dragOverIndex, 0, removed);
      onChange(newItems);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-2">
      <Label>사진 ({photoItems.length}/{MAX_PHOTOS}) *</Label>
      
      <div
        className={cn(
          "border-2 border-dashed border-gray-200 rounded-lg p-6 text-center transition-colors",
          isCompressing || disabled ? "opacity-50 pointer-events-none" : "hover:border-rose-300"
        )}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {isCompressing ? (
          <>
            <Loader2 className="w-8 h-8 mx-auto text-rose-400 mb-2 animate-spin" />
            <p className="text-sm text-gray-500">이미지 처리 중...</p>
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-500 mb-1">
              이미지를 드래그하거나 클릭하여 업로드
            </p>
            <p className="text-xs text-gray-400 mb-2">
              {MAX_FILE_SIZE_MB}MB 초과 시 자동 압축
            </p>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
              id="sale-photo-upload"
              disabled={disabled}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('sale-photo-upload')?.click()}
              disabled={disabled}
            >
              파일 선택
            </Button>
          </>
        )}
      </div>

      {photoItems.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {photoItems.map((item, index) => (
            <div
              key={item.type === 'existing' ? item.photo.url : `new-${index}`}
              draggable={!disabled}
              onDragStart={() => handlePhotoDragStart(index)}
              onDragOver={(e) => handlePhotoDragOver(e, index)}
              onDragEnd={handlePhotoDragEnd}
              className={cn(
                'relative aspect-square',
                !disabled && 'cursor-move',
                draggedIndex === index && 'opacity-50',
                dragOverIndex === index && 'ring-2 ring-rose-500 ring-offset-2'
              )}
            >
              <img
                src={item.type === 'existing' ? item.photo.url : item.preview}
                alt={`Photo ${index + 1}`}
                className="w-full h-full object-cover rounded-lg"
              />
              {!disabled && (
                <>
                  <div className="absolute top-1 left-1 bg-black/50 text-white rounded p-0.5">
                    <GripVertical className="w-3 h-3" />
                  </div>
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type { PhotoItem };

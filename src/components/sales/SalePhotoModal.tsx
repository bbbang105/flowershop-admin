'use client';

import { useState, useEffect, useCallback } from 'react';
import { PhotoCard, PhotoTag, PhotoFile } from '@/types/database';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Upload, Loader2, Plus, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
import {
  getPhotoCardBySaleId,
  createOrUpdatePhotoCardForSale,
  uploadPhotos,
  reorderPhotos
} from '@/lib/actions/photo-cards';
import { createPhotoTag, getPhotoTags } from '@/lib/actions/photo-tags';
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE_MB = 3;
const MAX_PHOTOS = 10;
const MAX_TAGS = 3;

const COMPRESSION_OPTIONS = {
  maxSizeMB: MAX_FILE_SIZE_MB,
  maxWidthOrHeight: 2560,
  useWebWorker: true,
};

type PhotoItem =
  | { type: 'existing'; photo: PhotoFile }
  | { type: 'new'; file: File; preview: string };

interface SalePhotoModalProps {
  open: boolean;
  onClose: () => void;
  saleId: string;
  defaultTitle: string;
  onSuccess?: () => void;
}

export function SalePhotoModal({
  open,
  onClose,
  saleId,
  defaultTitle,
  onSuccess,
}: SalePhotoModalProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [availableTags, setAvailableTags] = useState<PhotoTag[]>([]);
  const [existingCard, setExistingCard] = useState<PhotoCard | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  // 초기 데이터 로드
  useEffect(() => {
    if (open && saleId) {
      loadData();
    }
  }, [open, saleId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tags, card] = await Promise.all([
        getPhotoTags(),
        getPhotoCardBySaleId(saleId),
      ]);

      setAvailableTags(tags);

      if (card) {
        setExistingCard(card);
        setTitle(card.title);
        setDescription(card.description || '');
        setSelectedTags(card.tags);
        setPhotoItems(card.photos.map(photo => ({ type: 'existing', photo })));
      } else {
        setExistingCard(null);
        setTitle(defaultTitle);
        setDescription('');
        setSelectedTags([]);
        setPhotoItems([]);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('데이터 로드에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      photoItems.forEach(item => {
        if (item.type === 'new') URL.revokeObjectURL(item.preview);
      });
    };
  }, []);

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

      setPhotoItems(prev => [...prev, ...newItems]);
    } catch {
      toast.error('이미지 처리 중 오류가 발생했습니다');
    } finally {
      setIsCompressing(false);
    }
  }, [photoItems.length]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await addFiles(Array.from(e.target.files || []));
    e.target.value = '';
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    await addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const removePhoto = (index: number) => {
    setPhotoItems(prev => {
      const item = prev[index];
      if (item.type === 'new') URL.revokeObjectURL(item.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tagName)) {
        return prev.filter(t => t !== tagName);
      }
      if (prev.length >= MAX_TAGS) {
        toast.error(`태그는 최대 ${MAX_TAGS}개까지 선택할 수 있습니다`);
        return prev;
      }
      return [...prev, tagName];
    });
  };

  const handleAddNewTag = async () => {
    if (!newTagName.trim()) return;

    const canAutoSelect = selectedTags.length < MAX_TAGS;

    try {
      const newTag = await createPhotoTag(newTagName.trim(), newTagColor || undefined);
      if (newTag) {
        setAvailableTags(prev => [...prev, newTag]);
        if (canAutoSelect) {
          setSelectedTags(prev => [...prev, newTag.name]);
        }
        setNewTagName('');
        setNewTagColor('');
        toast.success('태그가 추가되었습니다');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '태그 추가에 실패했습니다');
    }
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
      setPhotoItems(prev => {
        const newItems = [...prev];
        const [removed] = newItems.splice(draggedIndex, 1);
        newItems.splice(dragOverIndex, 0, removed);
        return newItems;
      });
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('제목을 입력해주세요');
      return;
    }

    if (photoItems.length === 0) {
      toast.error('사진을 최소 1장 이상 등록해주세요');
      return;
    }

    setIsSubmitting(true);
    try {
      const existingPhotos = photoItems
        .filter((item): item is { type: 'existing'; photo: PhotoFile } => item.type === 'existing')
        .map(item => item.photo);

      const newFileItems = photoItems
        .filter((item): item is { type: 'new'; file: File; preview: string } => item.type === 'new');

      // 카드 생성/업데이트 (sale_id 연결, tags 포함)
      const card = await createOrUpdatePhotoCardForSale(
        saleId,
        title.trim(),
        existingPhotos,
        description.trim() || null,
        selectedTags
      );

      if (newFileItems.length > 0) {
        const uploadFormData = new FormData();
        newFileItems.forEach(item => {
          uploadFormData.append('files', item.file);
          uploadFormData.append('originalNames', item.file.name);
        });
        const uploadedPhotos = await uploadPhotos(card.id, uploadFormData);

        const uploadedQueue = [...uploadedPhotos];
        const finalPhotos: PhotoFile[] = photoItems.map(item =>
          item.type === 'existing' ? item.photo : uploadedQueue.shift()!
        );
        await reorderPhotos(card.id, finalPhotos);
      }

      toast.success(existingCard ? '사진이 수정되었습니다' : '사진이 등록되었습니다');
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '저장에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{existingCard ? '사진 수정' : '사진 등록'}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">제목 *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="작업물 제목을 입력하세요"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="description">설명</Label>
                <span className={cn(
                  "text-xs",
                  description.length > 200 ? "text-destructive" : "text-muted-foreground"
                )}>
                  {description.length}/200
                </span>
              </div>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 200))}
                placeholder="설명을 입력하세요 (선택)"
                className="min-h-[100px] resize-none"
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label>태그 ({selectedTags.length}/{MAX_TAGS})</Label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className={cn(
                      'cursor-pointer px-3 py-1.5 transition-colors',
                      selectedTags.includes(tag.name)
                        ? 'bg-brand text-brand-foreground'
                        : 'bg-muted text-foreground hover:bg-muted'
                    )}
                    onClick={() => toggleTag(tag.name)}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="새 태그 추가"
                  className="flex-1 max-w-xs"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNewTag()}
                />
                <input
                  type="color"
                  value={newTagColor || '#6b7280'}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="w-9 h-9 rounded border cursor-pointer"
                  title="색상 선택 (비워두면 랜덤)"
                />
                <Button type="button" size="icon" variant="outline" onClick={handleAddNewTag}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>사진 ({photoItems.length}/{MAX_PHOTOS}) *</Label>

              <div
                className={cn(
                  "border-2 border-dashed border-border rounded-lg p-6 text-center transition-colors",
                  isCompressing ? "opacity-50 pointer-events-none" : "hover:bg-brand-muted"
                )}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                {isCompressing ? (
                  <>
                    <Loader2 className="w-8 h-8 mx-auto text-brand mb-2 animate-spin" />
                    <p className="text-sm text-muted-foreground">이미지 처리 중...</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-1">
                      이미지를 드래그하거나 클릭하여 업로드
                    </p>
                    <p className="text-xs text-muted-foreground mb-2">
                      {MAX_FILE_SIZE_MB}MB 초과 시 자동 압축
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      id="sale-photo-modal-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('sale-photo-modal-upload')?.click()}
                    >
                      파일 선택
                    </Button>
                  </>
                )}
              </div>

              {photoItems.length > 0 && (
                <>
                  {photoItems.length > 1 && (
                    <p className="text-xs text-muted-foreground mt-2">드래그하여 순서를 변경할 수 있습니다</p>
                  )}
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {photoItems.map((item, index) => (
                      <div
                        key={item.type === 'existing' ? item.photo.url : `new-${index}`}
                        draggable
                        onDragStart={() => handlePhotoDragStart(index)}
                        onDragOver={(e) => handlePhotoDragOver(e, index)}
                        onDragEnd={handlePhotoDragEnd}
                        className={cn(
                          'relative aspect-square cursor-move',
                          draggedIndex === index && 'opacity-50',
                          dragOverIndex === index && 'ring-2 ring-brand ring-offset-2'
                        )}
                      >
                        <img
                          src={item.type === 'existing' ? item.photo.url : item.preview}
                          alt={`Photo ${index + 1}`}
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <div className="absolute top-1 left-1 bg-black/50 text-white rounded p-0.5">
                          <GripVertical className="w-3 h-3" />
                        </div>
                        <div className={cn(
                          'absolute bottom-1 left-1 text-white text-xs px-1 rounded',
                          item.type === 'new' ? 'bg-blue-500' : 'bg-black/50'
                        )}>
                          {item.type === 'new' ? 'NEW' : index + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 hover:bg-destructive/90"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isCompressing || isSubmitting}>
                취소
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isCompressing || isSubmitting}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                저장
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

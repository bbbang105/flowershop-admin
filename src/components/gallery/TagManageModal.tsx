'use client';

import { useState } from 'react';
import { PhotoTag, PHOTO_TAG_COLORS } from '@/types/database';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, Loader2, Pencil, Check } from 'lucide-react';
import { toast } from 'sonner';
import { createPhotoTag, updatePhotoTag, deletePhotoTag } from '@/lib/actions/photo-tags';

interface TagManageModalProps {
  open: boolean;
  onClose: () => void;
  tags: PhotoTag[];
  onTagsChange: () => void;
  onTagSelect?: (tagName: string) => void;
}

export function TagManageModal({ open, onClose, tags, onTagsChange, onTagSelect }: TagManageModalProps) {
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAdd = async () => {
    if (!newTagName.trim()) return;

    const tagName = newTagName.trim();
    setIsAdding(true);
    try {
      await createPhotoTag(tagName, newTagColor || undefined);
      setNewTagName('');
      setNewTagColor('');
      onTagsChange();
      toast.success('태그가 추가되었습니다');
      // 추가된 태그 선택
      if (onTagSelect) {
        onTagSelect(tagName);
        onClose();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '태그 추가 실패');
    } finally {
      setIsAdding(false);
    }
  };

  const handleStartEdit = (tag: PhotoTag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;

    setIsSaving(true);
    try {
      await updatePhotoTag(editingId, editName.trim(), editColor);
      setEditingId(null);
      onTagsChange();
      toast.success('태그가 수정되었습니다');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '태그 수정 실패');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    setIsDeleting(true);
    try {
      await deletePhotoTag(deletingId);
      setDeletingId(null);
      onTagsChange();
      toast.success('태그가 삭제되었습니다');
    } catch (error) {
      toast.error('태그 삭제 실패');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>태그 관리</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 새 태그 추가 */}
          <div className="flex gap-2">
            <Input
              placeholder="새 태그 이름"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="flex-1"
            />
            <input
              type="color"
              value={newTagColor || '#6b7280'}
              onChange={(e) => setNewTagColor(e.target.value)}
              className="w-10 h-9 rounded border cursor-pointer"
              title="색상 선택 (비워두면 랜덤)"
            />
            <Button
              onClick={handleAdd}
              size="icon"
              disabled={isAdding}
            >
              {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>

          {/* 태그 목록 */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">등록된 태그가 없습니다</p>
            ) : (
              tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted hover:bg-muted/80"
                >
                  {editingId === tag.id ? (
                    <>
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="w-8 h-8 rounded border cursor-pointer"
                      />
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 h-8"
                        autoFocus
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                      >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-green-600" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : deletingId === tag.id ? (
                    <div className="flex items-center gap-2 w-full">
                      <span className="flex-1 text-sm text-destructive">삭제하시겠습니까?</span>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 px-2"
                        onClick={handleDelete}
                        disabled={isDeleting}
                      >
                        {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : '삭제'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                        onClick={() => setDeletingId(null)}
                      >
                        취소
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div
                        className="w-6 h-6 rounded-full border"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1 text-sm font-medium">{tag.name}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleStartEdit(tag)}
                      >
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setDeletingId(tag.id)}
                      >
                        <X className="w-4 h-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

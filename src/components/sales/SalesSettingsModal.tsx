'use client';

import { useState } from 'react';
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
import {
  SaleCategory,
  createSaleCategory,
  updateSaleCategory,
  deleteSaleCategory,
} from '@/lib/actions/sale-settings';

interface SalesSettingsModalProps {
  open: boolean;
  onClose: () => void;
  categories: SaleCategory[];
  onRefresh: () => void;
}

export function SalesSettingsModal({
  open,
  onClose,
  categories,
  onRefresh,
}: SalesSettingsModalProps) {
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#f43f5e');
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatColor, setEditCatColor] = useState('');
  const [isSavingCat, setIsSavingCat] = useState(false);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);
  const [isDeletingCat, setIsDeletingCat] = useState(false);

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setIsAddingCat(true);
    try {
      await createSaleCategory(newCatName.trim(), newCatColor);
      setNewCatName('');
      onRefresh();
      toast.success('카테고리가 추가되었습니다');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '카테고리 추가 실패');
    } finally {
      setIsAddingCat(false);
    }
  };

  const handleSaveCatEdit = async () => {
    if (!editingCatId || !editCatName.trim()) return;
    setIsSavingCat(true);
    try {
      await updateSaleCategory(editingCatId, editCatName.trim(), editCatColor);
      setEditingCatId(null);
      onRefresh();
      toast.success('카테고리가 수정되었습니다');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '카테고리 수정 실패');
    } finally {
      setIsSavingCat(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCatId) return;
    setIsDeletingCat(true);
    try {
      await deleteSaleCategory(deletingCatId);
      setDeletingCatId(null);
      onRefresh();
      toast.success('카테고리가 삭제되었습니다');
    } catch (error) {
      toast.error('카테고리 삭제 실패');
    } finally {
      setIsDeletingCat(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>카테고리 관리</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4 py-4">
          <div className="flex gap-2">
            <Input
              placeholder="새 카테고리 이름"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              className="flex-1"
            />
            <input
              type="color"
              value={newCatColor}
              onChange={(e) => setNewCatColor(e.target.value)}
              className="w-10 h-9 rounded border cursor-pointer"
              title="색상 선택"
            />
            <Button
              onClick={handleAddCategory}
              size="icon"
              disabled={isAddingCat}
              className="bg-rose-500 hover:bg-rose-600"
            >
              {isAddingCat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>

          <div className="space-y-2 overflow-y-auto flex-1 pr-1">
            {categories.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">등록된 카테고리가 없습니다</p>
            ) : (
              categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-gray-100"
                >
                  {editingCatId === cat.id ? (
                    <>
                      <input
                        type="color"
                        value={editCatColor}
                        onChange={(e) => setEditCatColor(e.target.value)}
                        className="w-8 h-8 rounded border cursor-pointer"
                      />
                      <Input
                        value={editCatName}
                        onChange={(e) => setEditCatName(e.target.value)}
                        className="flex-1 h-8"
                        autoFocus
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={handleSaveCatEdit}
                        disabled={isSavingCat}
                      >
                        {isSavingCat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-green-600" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setEditingCatId(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : deletingCatId === cat.id ? (
                    <div className="flex items-center gap-2 w-full">
                      <span className="flex-1 text-sm text-red-600">삭제하시겠습니까?</span>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 px-2"
                        onClick={handleDeleteCategory}
                        disabled={isDeletingCat}
                      >
                        {isDeletingCat ? <Loader2 className="w-3 h-3 animate-spin" /> : '삭제'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                        onClick={() => setDeletingCatId(null)}
                      >
                        취소
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div
                        className="w-6 h-6 rounded-full border flex-shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="flex-1 text-sm font-medium">{cat.label}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingCatId(cat.id);
                          setEditCatName(cat.label);
                          setEditCatColor(cat.color);
                        }}
                      >
                        <Pencil className="w-4 h-4 text-gray-500" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setDeletingCatId(cat.id)}
                      >
                        <X className="w-4 h-4 text-red-500" />
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

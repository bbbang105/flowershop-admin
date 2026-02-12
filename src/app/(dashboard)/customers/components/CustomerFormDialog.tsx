'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createCustomer, updateCustomer, checkPhoneDuplicate } from '@/lib/actions/customers';
import { cn, formatPhoneNumber } from '@/lib/utils';
import type { Customer } from '@/types/database';

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer | null;
  onSuccess: () => void;
}

export function CustomerFormDialog({ open, onOpenChange, customer, onSuccess }: CustomerFormDialogProps) {
  const [phoneValue, setPhoneValue] = useState('');
  const [phoneDuplicate, setPhoneDuplicate] = useState<{ name: string } | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const phoneCheckRef = useRef<NodeJS.Timeout | null>(null);

  const isEditMode = !!customer;

  useEffect(() => {
    if (open) {
      if (customer) {
        setPhoneValue(formatPhoneNumber(customer.phone || ''));
        setNoteValue(customer.note || '');
      } else {
        setPhoneValue('');
        setNoteValue('');
      }
      setPhoneDuplicate(null);
      setIsSubmitting(false);
    }
  }, [open, customer]);

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setPhoneValue(formatted);
    setPhoneDuplicate(null);

    if (phoneCheckRef.current) clearTimeout(phoneCheckRef.current);

    if (formatted.length >= 12) {
      phoneCheckRef.current = setTimeout(async () => {
        const duplicate = await checkPhoneDuplicate(formatted, customer?.id);
        setPhoneDuplicate(duplicate);
      }, 300);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);

      if (isEditMode) {
        await updateCustomer(customer.id, formData);
        toast.success('고객 정보가 수정되었습니다');
      } else {
        await createCustomer(formData);
        toast.success('고객이 등록되었습니다');
      }

      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      console.error('Failed to save customer:', error);
      const message = error instanceof Error ? error.message : '';
      if (message.includes('이미') || (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === '23505')) {
        toast.error('이미 등록된 연락처입니다');
      } else {
        toast.error(isEditMode ? '고객 수정에 실패했습니다' : '고객 등록에 실패했습니다');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{isEditMode ? '고객 수정' : '고객 등록'}</DialogTitle>
          {!isEditMode && (
            <p className="text-sm text-muted-foreground">고객 정보를 등록하면 매출 입력 시 자동으로 연결돼요.</p>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label>고객명 *</Label>
            <Input
              name="name"
              placeholder="홍길동"
              required
              className="bg-muted"
              autoComplete="name"
              defaultValue={customer?.name || ''}
            />
          </div>
          <div className="space-y-2">
            <Label>연락처 *</Label>
            <Input
              name="phone"
              value={phoneValue}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="010-0000-0000"
              required
              inputMode="tel"
              autoComplete="tel"
              className={cn("bg-muted", phoneDuplicate && "border-red-500 focus-visible:ring-red-500")}
            />
            {phoneDuplicate && (
              <p className="text-xs text-destructive">
                이미 등록된 연락처입니다 ({phoneDuplicate.name})
              </p>
            )}
            {!isEditMode && (
              <p className="text-[11px] text-muted-foreground">같은 연락처의 고객은 중복 등록할 수 없어요</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>등급</Label>
              <Select name="grade" defaultValue={customer?.grade || 'new'}>
                <SelectTrigger className="bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">신규</SelectItem>
                  <SelectItem value="regular">단골</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="blacklist">블랙리스트</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>성별</Label>
              <Select name="gender" defaultValue={customer?.gender || 'none'}>
                <SelectTrigger className="bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">미지정</SelectItem>
                  <SelectItem value="male">남성</SelectItem>
                  <SelectItem value="female">여성</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>메모</Label>
              <span className={cn("text-xs", noteValue.length > 200 ? "text-destructive" : "text-muted-foreground")}>
                {noteValue.length}/200
              </span>
            </div>
            <Textarea
              name="note"
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value.slice(0, 200))}
              placeholder="고객에 대한 메모를 입력하세요..."
              className="bg-muted min-h-[80px] resize-none"
              maxLength={200}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
            <Button type="submit" disabled={isSubmitting || !!phoneDuplicate || phoneValue.length < 13}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isSubmitting ? '저장 중...' : '저장'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

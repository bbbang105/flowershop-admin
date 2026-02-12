'use server';

import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-guard';
import { PhotoTag } from '@/types/database';
import { withErrorLogging, AppError, ErrorCode } from '@/lib/errors';

async function _getPhotoTags(): Promise<PhotoTag[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('photo_tags')
    .select('*')
    .order('name');

  if (error) throw error;

  return data || [];
}

export const getPhotoTags = withErrorLogging('getPhotoTags', _getPhotoTags);

// 랜덤 색상 생성
const TAG_COLORS = [
  '#f5f5f5', '#ec4899', '#ef4444', '#eab308', '#a855f7',
  '#6366f1', '#14b8a6', '#f97316', '#22c55e', '#3b82f6',
];

function getRandomColor(): string {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
}

async function _createPhotoTag(name: string, color?: string): Promise<PhotoTag | null> {
  await requireAuth();
  const supabase = await createClient();

  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new AppError(ErrorCode.VALIDATION, '태그 이름을 입력해주세요');
  }

  const { data, error } = await supabase
    .from('photo_tags')
    .insert({
      name: trimmedName,
      color: color || getRandomColor(),
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError(ErrorCode.DUPLICATE, '이미 존재하는 태그입니다');
    }
    throw error;
  }

  return data;
}

export const createPhotoTag = withErrorLogging('createPhotoTag', _createPhotoTag);

async function _updatePhotoTag(id: string, name: string, color: string): Promise<void> {
  await requireAuth();
  const supabase = await createClient();

  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new AppError(ErrorCode.VALIDATION, '태그 이름을 입력해주세요');
  }

  const { error } = await supabase
    .from('photo_tags')
    .update({ name: trimmedName, color })
    .eq('id', id);

  if (error) {
    if (error.code === '23505') {
      throw new AppError(ErrorCode.DUPLICATE, '이미 존재하는 태그입니다');
    }
    throw error;
  }
}

export const updatePhotoTag = withErrorLogging('updatePhotoTag', _updatePhotoTag);

async function _deletePhotoTag(id: string): Promise<void> {
  await requireAuth();
  const supabase = await createClient();

  // 먼저 태그 이름 가져오기
  const { data: tag } = await supabase
    .from('photo_tags')
    .select('name')
    .eq('id', id)
    .single();

  if (tag) {
    // 해당 태그를 사용하는 모든 카드에서 태그 제거
    const { data: cards } = await supabase
      .from('photo_cards')
      .select('id, tags')
      .contains('tags', [tag.name]);

    if (cards && cards.length > 0) {
      for (const card of cards) {
        const newTags = (card.tags as string[]).filter(t => t !== tag.name);
        await supabase
          .from('photo_cards')
          .update({ tags: newTags })
          .eq('id', card.id);
      }
    }
  }

  // 태그 삭제
  const { error } = await supabase
    .from('photo_tags')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export const deletePhotoTag = withErrorLogging('deletePhotoTag', _deletePhotoTag);

'use server';

import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-guard';
import { PhotoCard, PhotoFile } from '@/types/database';
import { validateImageFile, photoCardSchema } from '@/lib/validations';
import { withErrorLogging, AppError, ErrorCode } from '@/lib/errors';
import { reportError } from '@/lib/logger';

const MAX_PHOTOS_PER_CARD = 10;

const PAGE_SIZE = 8;

export interface PhotoCardsResponse {
  cards: PhotoCard[];
  nextCursor: string | null;
  hasMore: boolean;
}

async function _getPhotoCards(
  tag?: string,
  cursor?: string,
  customerId?: string
): Promise<PhotoCardsResponse> {
  const supabase = await createClient();

  // 고객 필터가 있으면 sales 테이블 JOIN으로 photo_cards를 조회
  if (customerId) {
    // UUID 형식 검증
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(customerId)) {
      throw new AppError(ErrorCode.VALIDATION, '잘못된 고객 ID 형식입니다');
    }

    // 단일 쿼리: sales inner join으로 고객별 photo_cards 필터링
    let query = supabase
      .from('photo_cards')
      .select('*, sales!inner(customer_id)')
      .eq('sales.customer_id', customerId)
      .order('updated_at', { ascending: false })
      .limit(PAGE_SIZE + 1);

    if (tag) {
      query = query.contains('tags', [tag]);
    }

    if (cursor) {
      query = query.lt('updated_at', cursor);
    }

    const { data, error } = await query;

    if (error) throw error;

    // sales 조인 데이터 제거하고 순수 PhotoCard만 반환
    const cards = (data || []).map(({ sales: _sales, ...card }) => card) as PhotoCard[];
    const hasMore = cards.length > PAGE_SIZE;
    const resultCards = hasMore ? cards.slice(0, PAGE_SIZE) : cards;
    const nextCursor = hasMore && resultCards.length > 0
      ? resultCards[resultCards.length - 1].updated_at
      : null;

    return { cards: resultCards, nextCursor, hasMore };
  }

  // 기본: 전체 조회
  let query = supabase
    .from('photo_cards')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (tag) {
    query = query.contains('tags', [tag]);
  }

  if (cursor) {
    query = query.lt('updated_at', cursor);
  }

  const { data, error } = await query;

  if (error) throw error;

  const cards = data || [];
  const hasMore = cards.length > PAGE_SIZE;
  const resultCards = hasMore ? cards.slice(0, PAGE_SIZE) : cards;
  const nextCursor = hasMore && resultCards.length > 0
    ? resultCards[resultCards.length - 1].updated_at
    : null;

  return { cards: resultCards, nextCursor, hasMore };
}

export const getPhotoCards = withErrorLogging('getPhotoCards', _getPhotoCards);

async function _getPhotoCardById(id: string): Promise<PhotoCard | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('photo_cards')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;

  return data;
}

export const getPhotoCardById = withErrorLogging('getPhotoCardById', _getPhotoCardById);

async function _createPhotoCard(formData: FormData): Promise<PhotoCard> {
  await requireAuth();
  const supabase = await createClient();

  const title = formData.get('title') as string;
  const description = formData.get('description') as string | null;
  const tagsJson = formData.get('tags') as string;
  const photosJson = formData.get('photos') as string;
  const saleId = formData.get('sale_id') as string | null;

  let tags: string[];
  let photos: PhotoFile[];
  try {
    tags = tagsJson ? JSON.parse(tagsJson) : [];
    photos = photosJson ? JSON.parse(photosJson) : [];
  } catch {
    throw new AppError(ErrorCode.VALIDATION, '태그 또는 사진 데이터 형식이 올바르지 않습니다');
  }

  const parsed = photoCardSchema.safeParse({
    title: title?.trim(),
    description: description?.trim() || null,
    tags,
    photos,
  });
  if (!parsed.success) {
    throw new AppError(ErrorCode.VALIDATION, `입력값이 올바르지 않습니다: ${parsed.error.issues[0]?.message}`);
  }

  const { data, error } = await supabase
    .from('photo_cards')
    .insert({
      title: parsed.data.title,
      description: parsed.data.description || null,
      tags: parsed.data.tags || [],
      photos: parsed.data.photos || [],
      sale_id: saleId || null,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export const createPhotoCard = withErrorLogging('createPhotoCard', _createPhotoCard);

async function _updatePhotoCard(id: string, formData: FormData): Promise<void> {
  await requireAuth();
  const supabase = await createClient();

  const title = formData.get('title') as string;
  const description = formData.get('description') as string | null;
  const tagsJson = formData.get('tags') as string;
  const photosJson = formData.get('photos') as string;
  const saleId = formData.get('sale_id') as string | null;

  let tags: string[];
  let photos: PhotoFile[];
  try {
    tags = tagsJson ? JSON.parse(tagsJson) : [];
    photos = photosJson ? JSON.parse(photosJson) : [];
  } catch {
    throw new AppError(ErrorCode.VALIDATION, '태그 또는 사진 데이터 형식이 올바르지 않습니다');
  }

  const parsed = photoCardSchema.safeParse({
    title: title?.trim(),
    description: description?.trim() || null,
    tags,
    photos,
  });
  if (!parsed.success) {
    throw new AppError(ErrorCode.VALIDATION, `입력값이 올바르지 않습니다: ${parsed.error.issues[0]?.message}`);
  }

  const { error } = await supabase
    .from('photo_cards')
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      tags: parsed.data.tags || [],
      photos: parsed.data.photos || [],
      sale_id: saleId || null,
    })
    .eq('id', id);

  if (error) throw error;
}

export const updatePhotoCard = withErrorLogging('updatePhotoCard', _updatePhotoCard);

async function _deletePhotoCard(id: string): Promise<PhotoFile[]> {
  await requireAuth();
  const supabase = await createClient();

  // Get card to retrieve photo URLs for storage cleanup
  const { data: card } = await supabase
    .from('photo_cards')
    .select('photos')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('photo_cards')
    .delete()
    .eq('id', id);

  if (error) throw error;

  // Return photos for storage cleanup
  return (card?.photos as PhotoFile[]) || [];
}

export const deletePhotoCard = withErrorLogging('deletePhotoCard', _deletePhotoCard);


async function _uploadPhotos(cardId: string, formData: FormData): Promise<PhotoFile[]> {
  await requireAuth();
  const supabase = await createClient();

  // Get current card to check photo count
  const { data: card } = await supabase
    .from('photo_cards')
    .select('photos')
    .eq('id', cardId)
    .single();

  const currentPhotos = (card?.photos as PhotoFile[]) || [];
  const files = formData.getAll('files') as File[];
  const originalNames = formData.getAll('originalNames') as string[];

  if (currentPhotos.length + files.length > MAX_PHOTOS_PER_CARD) {
    throw new AppError(ErrorCode.VALIDATION, `사진은 최대 ${MAX_PHOTOS_PER_CARD}장까지 등록할 수 있습니다. 현재 ${currentPhotos.length}장 등록됨.`);
  }

  const uploadedPhotos: PhotoFile[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const imageError = validateImageFile(file);
    if (imageError) throw new AppError(ErrorCode.VALIDATION, imageError);

    const originalName = originalNames[i] || file.name;
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${cardId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from('photo-cards')
      .upload(fileName, arrayBuffer, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      await reportError(uploadError, { action: 'uploadPhotos', extra: { file: originalName } });
      continue;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('photo-cards')
      .getPublicUrl(fileName);

    uploadedPhotos.push({ url: publicUrl, originalName });
  }

  // Update card with new photos
  const newPhotos = [...currentPhotos, ...uploadedPhotos];

  const { error: updateError } = await supabase
    .from('photo_cards')
    .update({ photos: newPhotos })
    .eq('id', cardId);

  if (updateError) throw updateError;

  return uploadedPhotos;
}

export const uploadPhotos = withErrorLogging('uploadPhotos', _uploadPhotos);

async function _deletePhoto(cardId: string, photoUrl: string): Promise<void> {
  await requireAuth();
  const supabase = await createClient();

  // Get current card
  const { data: card } = await supabase
    .from('photo_cards')
    .select('photos')
    .eq('id', cardId)
    .single();

  if (!card) {
    throw new AppError(ErrorCode.NOT_FOUND, '카드를 찾을 수 없습니다');
  }

  // Remove photo from array
  const photos = card.photos as PhotoFile[];
  const newPhotos = photos.filter((p) => p.url !== photoUrl);

  // Update card
  const { error: updateError } = await supabase
    .from('photo_cards')
    .update({ photos: newPhotos })
    .eq('id', cardId);

  if (updateError) throw updateError;

  // Delete from storage
  try {
    const urlParts = photoUrl.split('/photo-cards/');
    if (urlParts.length > 1) {
      const filePath = urlParts[1];
      await supabase.storage.from('photo-cards').remove([filePath]);
    }
  } catch {
    // Storage 삭제 실패는 무시 (DB 레코드는 이미 삭제됨)
  }
}

export const deletePhoto = withErrorLogging('deletePhoto', _deletePhoto);

async function _deletePhotosFromStorage(photos: PhotoFile[]): Promise<void> {
  await requireAuth();
  const supabase = await createClient();

  const filePaths = photos
    .map(photo => {
      const parts = photo.url.split('/photo-cards/');
      return parts.length > 1 ? parts[1] : null;
    })
    .filter((path): path is string => path !== null);

  if (filePaths.length > 0) {
    await supabase.storage.from('photo-cards').remove(filePaths);
  }
}

export const deletePhotosFromStorage = withErrorLogging('deletePhotosFromStorage', _deletePhotosFromStorage);

async function _reorderPhotos(cardId: string, photos: PhotoFile[]): Promise<void> {
  await requireAuth();
  const supabase = await createClient();

  const { error } = await supabase
    .from('photo_cards')
    .update({ photos })
    .eq('id', cardId);

  if (error) throw error;
}

export const reorderPhotos = withErrorLogging('reorderPhotos', _reorderPhotos);


async function _downloadPhoto(photo: PhotoFile): Promise<{ url: string; filename: string } | null> {
  const supabase = await createClient();

  try {
    const urlParts = photo.url.split('/photo-cards/');
    if (urlParts.length <= 1) return null;

    const filePath = urlParts[1];

    const { data, error } = await supabase.storage
      .from('photo-cards')
      .createSignedUrl(filePath, 60);

    if (error || !data) return null;

    return {
      url: data.signedUrl,
      filename: photo.originalName,
    };
  } catch {
    return null;
  }
}

export const downloadPhoto = withErrorLogging('downloadPhoto', _downloadPhoto);

async function _downloadAllPhotos(cardId: string): Promise<{ urls: Array<{ url: string; filename: string }> }> {
  const supabase = await createClient();

  const { data: card } = await supabase
    .from('photo_cards')
    .select('photos, title')
    .eq('id', cardId)
    .single();

  const photos = (card?.photos as PhotoFile[]) || [];
  if (!photos.length) {
    return { urls: [] };
  }

  // 병렬 다운로드 (순차 → Promise.all)
  const results = await Promise.all(photos.map((photo) => downloadPhoto(photo)));
  const downloadUrls = results.filter((r): r is { url: string; filename: string } => r !== null);

  return { urls: downloadUrls };
}

export const downloadAllPhotos = withErrorLogging('downloadAllPhotos', _downloadAllPhotos);


async function _getPhotoCardBySaleId(saleId: string): Promise<PhotoCard | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('photo_cards')
    .select('*')
    .eq('sale_id', saleId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data;
}

export const getPhotoCardBySaleId = withErrorLogging('getPhotoCardBySaleId', _getPhotoCardBySaleId);

async function _createOrUpdatePhotoCardForSale(
  saleId: string,
  title: string,
  photos: PhotoFile[],
  description?: string | null,
  tags?: string[]
): Promise<PhotoCard> {
  await requireAuth();
  const supabase = await createClient();

  // Check if card already exists for this sale
  const existingCard = await getPhotoCardBySaleId(saleId);

  if (existingCard) {
    // Update existing card
    const { data, error } = await supabase
      .from('photo_cards')
      .update({
        title,
        photos,
        ...(description !== undefined && { description }),
        ...(tags !== undefined && { tags }),
      })
      .eq('id', existingCard.id)
      .select()
      .single();

    if (error) throw error;

    return data;
  } else {
    // Create new card
    const { data, error } = await supabase
      .from('photo_cards')
      .insert({
        title,
        description: description || null,
        tags: tags || [],
        photos,
        sale_id: saleId,
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  }
}

export const createOrUpdatePhotoCardForSale = withErrorLogging('createOrUpdatePhotoCardForSale', _createOrUpdatePhotoCardForSale);

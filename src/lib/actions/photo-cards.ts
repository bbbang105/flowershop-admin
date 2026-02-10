'use server';

import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-guard';
import { PhotoCard, PhotoFile } from '@/types/database';

const MAX_PHOTOS_PER_CARD = 10;

const PAGE_SIZE = 8;

export interface PhotoCardsResponse {
  cards: PhotoCard[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function getPhotoCards(
  tag?: string,
  cursor?: string
): Promise<PhotoCardsResponse> {
  const supabase = await createClient();
  
  let query = supabase
    .from('photo_cards')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(PAGE_SIZE + 1); // Fetch one extra to check if there's more
  
  if (tag) {
    query = query.contains('tags', [tag]);
  }
  
  if (cursor) {
    query = query.lt('updated_at', cursor);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching photo cards:', error);
    return { cards: [], nextCursor: null, hasMore: false };
  }
  
  const cards = data || [];
  const hasMore = cards.length > PAGE_SIZE;
  const resultCards = hasMore ? cards.slice(0, PAGE_SIZE) : cards;
  const nextCursor = hasMore && resultCards.length > 0 
    ? resultCards[resultCards.length - 1].updated_at 
    : null;
  
  return { cards: resultCards, nextCursor, hasMore };
}

export async function getPhotoCardById(id: string): Promise<PhotoCard | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('photo_cards')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('Error fetching photo card:', error);
    return null;
  }
  
  return data;
}

export async function createPhotoCard(formData: FormData): Promise<PhotoCard> {
  await requireAuth();
  const supabase = await createClient();
  
  const title = formData.get('title') as string;
  const description = formData.get('description') as string | null;
  const tagsJson = formData.get('tags') as string;
  const photosJson = formData.get('photos') as string;
  const saleId = formData.get('sale_id') as string | null;

  const trimmedTitle = title?.trim();
  if (!trimmedTitle) {
    throw new Error('제목을 입력해주세요');
  }
  
  const tags: string[] = tagsJson ? JSON.parse(tagsJson) : [];
  const photos: PhotoFile[] = photosJson ? JSON.parse(photosJson) : [];
  
  if (photos.length > MAX_PHOTOS_PER_CARD) {
    throw new Error(`사진은 최대 ${MAX_PHOTOS_PER_CARD}장까지 등록할 수 있습니다`);
  }
  
  const { data, error } = await supabase
    .from('photo_cards')
    .insert({
      title: trimmedTitle,
      description: description?.trim() || null,
      tags,
      photos,
      sale_id: saleId || null,
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating photo card:', error);
    throw new Error('사진 카드 생성에 실패했습니다');
  }
  
  return data;
}

export async function updatePhotoCard(id: string, formData: FormData): Promise<void> {
  await requireAuth();
  const supabase = await createClient();
  
  const title = formData.get('title') as string;
  const description = formData.get('description') as string | null;
  const tagsJson = formData.get('tags') as string;
  const photosJson = formData.get('photos') as string;
  const saleId = formData.get('sale_id') as string | null;
  
  const trimmedTitle = title?.trim();
  if (!trimmedTitle) {
    throw new Error('제목을 입력해주세요');
  }
  
  const tags: string[] = tagsJson ? JSON.parse(tagsJson) : [];
  const photos: PhotoFile[] = photosJson ? JSON.parse(photosJson) : [];
  
  if (photos.length > MAX_PHOTOS_PER_CARD) {
    throw new Error(`사진은 최대 ${MAX_PHOTOS_PER_CARD}장까지 등록할 수 있습니다`);
  }
  
  const { error } = await supabase
    .from('photo_cards')
    .update({
      title: trimmedTitle,
      description: description?.trim() || null,
      tags,
      photos,
      sale_id: saleId || null,
    })
    .eq('id', id);
  
  if (error) {
    console.error('Error updating photo card:', error);
    throw new Error('사진 카드 수정에 실패했습니다');
  }
}

export async function deletePhotoCard(id: string): Promise<PhotoFile[]> {
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
  
  if (error) {
    console.error('Error deleting photo card:', error);
    throw new Error('사진 카드 삭제에 실패했습니다');
  }
  
  // Return photos for storage cleanup
  return (card?.photos as PhotoFile[]) || [];
}


export async function uploadPhotos(cardId: string, formData: FormData): Promise<PhotoFile[]> {
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
    throw new Error(`사진은 최대 ${MAX_PHOTOS_PER_CARD}장까지 등록할 수 있습니다. 현재 ${currentPhotos.length}장 등록됨.`);
  }
  
  const uploadedPhotos: PhotoFile[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
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
      console.error('Error uploading photo:', uploadError);
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
  
  if (updateError) {
    console.error('Error updating photo card:', updateError);
    throw new Error('사진 업로드 후 카드 업데이트에 실패했습니다');
  }
  
  return uploadedPhotos;
}

export async function deletePhoto(cardId: string, photoUrl: string): Promise<void> {
  await requireAuth();
  const supabase = await createClient();
  
  // Get current card
  const { data: card } = await supabase
    .from('photo_cards')
    .select('photos')
    .eq('id', cardId)
    .single();
  
  if (!card) {
    throw new Error('카드를 찾을 수 없습니다');
  }
  
  // Remove photo from array
  const photos = card.photos as PhotoFile[];
  const newPhotos = photos.filter((p) => p.url !== photoUrl);
  
  // Update card
  const { error: updateError } = await supabase
    .from('photo_cards')
    .update({ photos: newPhotos })
    .eq('id', cardId);
  
  if (updateError) {
    console.error('Error updating photo card:', updateError);
    throw new Error('사진 삭제에 실패했습니다');
  }
  
  // Delete from storage
  try {
    const urlParts = photoUrl.split('/photo-cards/');
    if (urlParts.length > 1) {
      const filePath = urlParts[1];
      await supabase.storage.from('photo-cards').remove([filePath]);
    }
  } catch (storageError) {
    console.error('Error deleting from storage:', storageError);
  }
}

export async function deletePhotosFromStorage(photos: PhotoFile[]): Promise<void> {
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

export async function reorderPhotos(cardId: string, photos: PhotoFile[]): Promise<void> {
  await requireAuth();
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('photo_cards')
    .update({ photos })
    .eq('id', cardId);
  
  if (error) {
    console.error('Error reordering photos:', error);
    throw new Error('사진 순서 변경에 실패했습니다');
  }
}


export async function downloadPhoto(photo: PhotoFile): Promise<{ url: string; filename: string } | null> {
  const supabase = await createClient();
  
  try {
    const urlParts = photo.url.split('/photo-cards/');
    if (urlParts.length <= 1) return null;
    
    const filePath = urlParts[1];
    
    const { data, error } = await supabase.storage
      .from('photo-cards')
      .createSignedUrl(filePath, 60);
    
    if (error || !data) {
      console.error('Error creating signed URL:', error);
      return null;
    }
    
    return {
      url: data.signedUrl,
      filename: photo.originalName,
    };
  } catch (error) {
    console.error('Error downloading photo:', error);
    return null;
  }
}

export async function downloadAllPhotos(cardId: string): Promise<{ urls: Array<{ url: string; filename: string }> }> {
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
  
  const downloadUrls: Array<{ url: string; filename: string }> = [];
  
  for (const photo of photos) {
    const result = await downloadPhoto(photo);
    if (result) {
      downloadUrls.push(result);
    }
  }
  
  return { urls: downloadUrls };
}


export async function getPhotoCardBySaleId(saleId: string): Promise<PhotoCard | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('photo_cards')
    .select('*')
    .eq('sale_id', saleId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Error fetching photo card by sale_id:', error);
    return null;
  }
  
  return data;
}

export async function createOrUpdatePhotoCardForSale(
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
    
    if (error) {
      console.error('Error updating photo card for sale:', error);
      throw new Error('사진 카드 업데이트에 실패했습니다');
    }
    
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
    
    if (error) {
      console.error('Error creating photo card for sale:', error);
      throw new Error('사진 카드 생성에 실패했습니다');
    }
    
    return data;
  }
}

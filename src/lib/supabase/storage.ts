'use server';

import { createClient } from './server';

const BUCKET_NAME = 'sale-photos';

export async function uploadSalePhoto(
  saleId: string,
  file: File
): Promise<string> {
  const supabase = await createClient();
  
  const fileExt = file.name.split('.').pop();
  const fileName = `${saleId}/${Date.now()}.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });
  
  if (error) throw error;
  
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);
  
  return urlData.publicUrl;
}

export async function deleteSalePhoto(photoUrl: string): Promise<void> {
  const supabase = await createClient();
  
  // Extract path from URL
  const url = new URL(photoUrl);
  const pathParts = url.pathname.split(`/storage/v1/object/public/${BUCKET_NAME}/`);
  if (pathParts.length < 2) return;
  
  const filePath = pathParts[1];
  
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filePath]);
  
  if (error) throw error;
}

export async function deleteSalePhotos(saleId: string): Promise<void> {
  const supabase = await createClient();
  
  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET_NAME)
    .list(saleId);
  
  if (listError) throw listError;
  if (!files || files.length === 0) return;
  
  const filePaths = files.map(f => `${saleId}/${f.name}`);
  
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove(filePaths);
  
  if (error) throw error;
}

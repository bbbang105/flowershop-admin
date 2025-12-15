import { getPhotoCards } from '@/lib/actions/photo-cards';
import { getPhotoTags } from '@/lib/actions/photo-tags';
import { GalleryClient } from './gallery-client';

export default async function GalleryPage() {
  const [initialData, photoTags] = await Promise.all([
    getPhotoCards(),
    getPhotoTags(),
  ]);

  return <GalleryClient initialData={initialData} tags={photoTags} />;
}

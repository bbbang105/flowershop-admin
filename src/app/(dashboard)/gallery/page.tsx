import { getPhotoCards } from '@/lib/actions/photo-cards';
import { getPhotoTags } from '@/lib/actions/photo-tags';
import { getCustomers } from '@/lib/actions';
import { GalleryClient } from './gallery-client';

export default async function GalleryPage() {
  const [initialData, photoTags, customers] = await Promise.all([
    getPhotoCards(),
    getPhotoTags(),
    getCustomers(),
  ]);

  const customerList = customers.map(c => ({ id: c.id, name: c.name }));

  return <GalleryClient initialData={initialData} tags={photoTags} customers={customerList} />;
}

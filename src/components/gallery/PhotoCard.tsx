'use client';

import { PhotoCard as PhotoCardType } from '@/types/database';
import { Card } from '@/components/ui/card';
import { Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface PhotoCardProps {
  card: PhotoCardType;
  tagColorMap: Map<string, string>;
  onClick: () => void;
}

export function PhotoCard({ card, tagColorMap, onClick }: PhotoCardProps) {
  const photos = card.photos;
  const photoCount = photos.length;
  const createdDate = format(new Date(card.created_at), 'yy.MM.dd HH:mm', { locale: ko });
  const updatedDate = format(new Date(card.updated_at), 'yy.MM.dd HH:mm', { locale: ko });
  const isUpdated = card.created_at !== card.updated_at;

  // 콜라주 레이아웃 렌더링
  const renderCollage = () => {
    if (photoCount === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <ImageIcon className="w-10 h-10 text-muted-foreground" />
        </div>
      );
    }

    if (photoCount === 1) {
      return (
        <Image
          src={photos[0].url}
          alt={card.title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
      );
    }

    if (photoCount === 2) {
      return (
        <div className="w-full h-full grid grid-cols-2 gap-0.5">
          {photos.slice(0, 2).map((photo, i) => (
            <div key={i} className="relative w-full h-full">
              <Image
                src={photo.url}
                alt=""
                fill
                sizes="(max-width: 640px) 25vw, (max-width: 1024px) 16vw, (max-width: 1280px) 12vw, 10vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      );
    }

    if (photoCount === 3) {
      return (
        <div className="w-full h-full flex gap-0.5">
          <div className="relative w-1/2 h-full">
            <Image
              src={photos[0].url}
              alt=""
              fill
              sizes="(max-width: 640px) 25vw, (max-width: 1024px) 16vw, (max-width: 1280px) 12vw, 10vw"
              className="object-cover"
            />
          </div>
          <div className="w-1/2 h-full flex flex-col gap-0.5">
            <div className="relative w-full h-1/2">
              <Image
                src={photos[1].url}
                alt=""
                fill
                sizes="(max-width: 640px) 25vw, (max-width: 1024px) 16vw, (max-width: 1280px) 12vw, 10vw"
                className="object-cover"
              />
            </div>
            <div className="relative w-full h-1/2">
              <Image
                src={photos[2].url}
                alt=""
                fill
                sizes="(max-width: 640px) 25vw, (max-width: 1024px) 16vw, (max-width: 1280px) 12vw, 10vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      );
    }

    // 4개 이상
    return (
      <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-0.5">
        {photos.slice(0, 4).map((photo, i) => (
          <div key={i} className="relative overflow-hidden">
            <Image
              src={photo.url}
              alt=""
              fill
              sizes="(max-width: 640px) 25vw, (max-width: 1024px) 16vw, (max-width: 1280px) 12vw, 10vw"
              className="object-cover"
            />
            {i === 3 && photoCount > 4 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white font-medium text-sm">+{photoCount - 4}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card
      className="group cursor-pointer overflow-hidden hover:shadow-lg transition-shadow"
      onClick={onClick}
    >
      <div className="relative aspect-square bg-muted overflow-hidden rounded-t-lg">
        {renderCollage()}
      </div>

      <div className="p-2.5">
        <h3 className="font-medium text-foreground truncate text-sm">{card.title}</h3>
        {card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {card.tags.slice(0, 3).map((tagName) => {
              const color = tagColorMap.get(tagName) || '#6b7280';
              return (
                <span
                  key={tagName}
                  className="text-[10px] px-1.5 py-0.5 rounded-full text-white truncate max-w-[60px]"
                  style={{ backgroundColor: color }}
                  title={tagName}
                >
                  {tagName}
                </span>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {isUpdated ? `수정 ${updatedDate}` : createdDate}
        </p>
      </div>
    </Card>
  );
}

'use client';

import { PhotoCard as PhotoCardType, PhotoTag } from '@/types/database';
import { PhotoCard } from './PhotoCard';
import { Image } from 'lucide-react';

interface PhotoCardGridProps {
  cards: PhotoCardType[];
  tags: PhotoTag[];
  onCardClick: (card: PhotoCardType) => void;
}

export function PhotoCardGrid({ cards, tags, onCardClick }: PhotoCardGridProps) {
  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Image className="w-16 h-16 mb-4 text-muted-foreground/50" />
        <p className="text-lg font-medium">등록된 사진이 없습니다</p>
        <p className="text-sm mt-1">새 카드를 추가해서 작업물을 기록해보세요</p>
      </div>
    );
  }

  // 태그 이름 -> 색상 맵 생성
  const tagColorMap = new Map(tags.map(t => [t.name, t.color]));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
      {cards.map((card) => (
        <PhotoCard
          key={card.id}
          card={card}
          tagColorMap={tagColorMap}
          onClick={() => onCardClick(card)}
        />
      ))}
    </div>
  );
}

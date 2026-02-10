'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PhotoCard, PhotoTag } from '@/types/database';
import { PhotoCardGrid } from '@/components/gallery/PhotoCardGrid';
import { TagFilter } from '@/components/gallery/TagFilter';
import { PhotoUploadModal } from '@/components/gallery/PhotoUploadModal';
import { PhotoCardDialog } from '@/components/gallery/PhotoCardDialog';
import { TagManageModal } from '@/components/gallery/TagManageModal';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Settings } from 'lucide-react';
import { getPhotoCards, PhotoCardsResponse } from '@/lib/actions/photo-cards';
import { getPhotoTags } from '@/lib/actions/photo-tags';

interface GalleryClientProps {
  initialData: PhotoCardsResponse;
  tags: PhotoTag[];
}

export function GalleryClient({ initialData, tags: initialTags }: GalleryClientProps) {
  const [cards, setCards] = useState<PhotoCard[]>(initialData.cards);
  const [cursor, setCursor] = useState<string | null>(initialData.nextCursor);
  const [hasMore, setHasMore] = useState(initialData.hasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<PhotoCard | null>(null);
  const [editingCard, setEditingCard] = useState<PhotoCard | null>(null);
  const [tags, setTags] = useState<PhotoTag[]>(initialTags);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const refreshTags = async () => {
    const newTags = await getPhotoTags();
    setTags(newTags);
  };


  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      const response = await getPhotoCards(selectedTag || undefined, cursor || undefined);
      setCards(prev => [...prev, ...response.cards]);
      setCursor(response.nextCursor);
      setHasMore(response.hasMore);
    } catch (error) {
      console.error('Error loading more cards:', error);
    } finally {
      setIsLoading(false);
    }
  }, [cursor, hasMore, isLoading, selectedTag]);

  // Reset and reload when tag changes
  useEffect(() => {
    const loadInitial = async () => {
      setIsLoading(true);
      try {
        const response = await getPhotoCards(selectedTag || undefined);
        setCards(response.cards);
        setCursor(response.nextCursor);
        setHasMore(response.hasMore);
      } catch (error) {
        console.error('Error loading cards:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadInitial();
  }, [selectedTag]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoading, loadMore]);

  const refreshCards = async () => {
    setIsLoading(true);
    try {
      const response = await getPhotoCards(selectedTag || undefined);
      setCards(response.cards);
      setCursor(response.nextCursor);
      setHasMore(response.hasMore);
    } catch (error) {
      console.error('Error refreshing cards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCardClick = (card: PhotoCard) => {
    setSelectedCard(card);
  };

  const handleEdit = (card: PhotoCard) => {
    setSelectedCard(null);
    setEditingCard(card);
    setIsUploadModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsUploadModalOpen(false);
    setEditingCard(null);
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">사진첩</h1>
          <p className="text-sm text-muted-foreground mt-1">완성한 꽃 작업물 사진을 저장하고 태그로 분류할 수 있어요</p>
        </div>
        <Button
          onClick={() => setIsUploadModalOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          새 카드 추가
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <TagFilter
          tags={tags}
          selectedTag={selectedTag}
          onSelectTag={setSelectedTag}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsTagModalOpen(true)}
          className="shrink-0"
          title="태그 관리"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      <PhotoCardGrid
        cards={cards}
        tags={tags}
        onCardClick={handleCardClick}
      />

      {/* Infinite scroll trigger */}
      <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
        {isLoading && (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        )}
        {!hasMore && cards.length > 0 && (
          <p className="text-sm text-muted-foreground">모든 카드를 불러왔습니다</p>
        )}
      </div>

      <PhotoUploadModal
        open={isUploadModalOpen}
        onClose={handleCloseModal}
        tags={tags}
        editingCard={editingCard}
        onSuccess={refreshCards}
        onTagsChange={refreshTags}
      />

      <PhotoCardDialog
        card={selectedCard}
        onClose={() => setSelectedCard(null)}
        onEdit={handleEdit}
        onDelete={refreshCards}
      />

      <TagManageModal
        open={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        tags={tags}
        onTagsChange={refreshTags}
        onTagSelect={setSelectedTag}
      />
    </div>
  );
}

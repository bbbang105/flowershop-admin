'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PhotoCard, PhotoTag } from '@/types/database';
import { PhotoCardGrid } from '@/components/gallery/PhotoCardGrid';
import { TagFilter } from '@/components/gallery/TagFilter';
import { PhotoUploadModal } from '@/components/gallery/PhotoUploadModal';
import { PhotoCardDialog } from '@/components/gallery/PhotoCardDialog';
import { TagManageModal } from '@/components/gallery/TagManageModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Loader2, Settings, X, User, Image as ImageIcon } from 'lucide-react';
import { getPhotoCards, PhotoCardsResponse } from '@/lib/actions/photo-cards';
import { getPhotoTags } from '@/lib/actions/photo-tags';
import { toast } from 'sonner';

interface CustomerOption {
  id: string;
  name: string;
}

interface GalleryClientProps {
  initialData: PhotoCardsResponse;
  tags: PhotoTag[];
  customers: CustomerOption[];
}

export function GalleryClient({ initialData, tags: initialTags, customers }: GalleryClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialCustomerId = searchParams.get('customer');
  const initialCustomer = initialCustomerId
    ? customers.find(c => c.id === initialCustomerId) || null
    : null;

  const [cards, setCards] = useState<PhotoCard[]>(initialData.cards);
  const [cursor, setCursor] = useState<string | null>(initialData.nextCursor);
  const [hasMore, setHasMore] = useState(initialData.hasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(initialCustomer);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<PhotoCard | null>(null);
  const [editingCard, setEditingCard] = useState<PhotoCard | null>(null);
  const [tags, setTags] = useState<PhotoTag[]>(initialTags);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // 고객 검색 결과 메모이제이션
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return [];
    return customers
      .filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
      .slice(0, 8);
  }, [customers, customerSearch]);

  const refreshTags = async () => {
    const newTags = await getPhotoTags();
    setTags(newTags);
  };

  // 고객 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      const response = await getPhotoCards(selectedTag || undefined, cursor || undefined, selectedCustomer?.id);
      setCards(prev => [...prev, ...response.cards]);
      setCursor(response.nextCursor);
      setHasMore(response.hasMore);
    } catch (error) {
      console.error('Error loading more cards:', error);
    } finally {
      setIsLoading(false);
    }
  }, [cursor, hasMore, isLoading, selectedTag, selectedCustomer]);

  // Reset and reload when tag or customer changes
  useEffect(() => {
    const loadInitial = async () => {
      setIsLoading(true);
      try {
        const response = await getPhotoCards(selectedTag || undefined, undefined, selectedCustomer?.id);
        setCards(response.cards);
        setCursor(response.nextCursor);
        setHasMore(response.hasMore);
      } catch (error) {
        console.error('Error loading cards:', error);
        toast.error('사진 카드를 불러오는데 실패했습니다');
      } finally {
        setIsLoading(false);
      }
    };
    loadInitial();
  }, [selectedTag, selectedCustomer]);

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
      const response = await getPhotoCards(selectedTag || undefined, undefined, selectedCustomer?.id);
      setCards(response.cards);
      setCursor(response.nextCursor);
      setHasMore(response.hasMore);
    } catch (error) {
      console.error('Error refreshing cards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCustomer = (customer: CustomerOption) => {
    setSelectedCustomer(customer);
    setCustomerSearch('');
    setShowCustomerDropdown(false);
    router.push(`/gallery?customer=${customer.id}`, { scroll: false });
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    router.push('/gallery', { scroll: false });
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

      <div className="flex flex-col gap-3">
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
            aria-label="태그 관리"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        {/* 고객 필터 */}
        <div className="flex items-center gap-2">
          {selectedCustomer ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-brand/10 text-brand rounded-lg text-sm font-medium border border-brand/20">
              <User className="w-3.5 h-3.5" />
              <span>{selectedCustomer.name}</span>
              <button
                type="button"
                onClick={handleClearCustomer}
                className="hover:text-brand/70 transition-colors"
                aria-label="고객 필터 해제"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative" ref={customerDropdownRef}>
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="고객으로 필터링..."
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault();
                    if (e.key === 'Escape') setShowCustomerDropdown(false);
                  }}
                  className="h-8 w-48 pl-8 text-sm"
                />
              </div>
              {showCustomerDropdown && customerSearch.length > 0 && (
                <div
                  className="absolute z-50 mt-1 w-56 bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto"
                  role="listbox"
                  aria-label="고객 목록"
                >
                  {filteredCustomers.map(customer => (
                    <button
                      key={customer.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted flex items-center gap-2 transition-colors"
                      onClick={() => handleSelectCustomer(customer)}
                    >
                      <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{customer.name}</span>
                    </button>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <div className="px-3 py-2.5 text-sm text-muted-foreground">검색 결과 없음</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 고객 필터 시 빈 상태 */}
      {!isLoading && cards.length === 0 && selectedCustomer && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
          <div>
            <p className="font-medium text-foreground">{selectedCustomer.name}님의 사진이 없습니다</p>
            <p className="text-sm text-muted-foreground mt-1">매출 등록 시 사진을 추가해보세요</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleClearCustomer}>
            모든 사진 보기
          </Button>
        </div>
      )}

      {(cards.length > 0 || !selectedCustomer) && (
        <PhotoCardGrid
          cards={cards}
          tags={tags}
          onCardClick={handleCardClick}
        />
      )}

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

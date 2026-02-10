'use client';

import { PhotoTag } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TagFilterProps {
  tags: PhotoTag[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
}

export function TagFilter({ tags, selectedTag, onSelectTag }: TagFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge
        variant="secondary"
        className={cn(
          'cursor-pointer px-3 py-1.5 text-sm transition-colors',
          selectedTag === null
            ? 'bg-brand text-brand-foreground hover:bg-brand/90'
            : 'bg-muted text-foreground hover:bg-muted/80'
        )}
        onClick={() => onSelectTag(null)}
      >
        전체
      </Badge>
      {tags.map((tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className={cn(
            'cursor-pointer px-3 py-1.5 text-sm transition-colors',
            selectedTag === tag.name
              ? 'bg-brand text-brand-foreground hover:bg-brand/90'
              : 'bg-muted text-foreground hover:bg-muted/80'
          )}
          style={selectedTag === tag.name ? {} : { borderLeft: `3px solid ${tag.color}` }}
          onClick={() => onSelectTag(tag.name)}
        >
          {tag.name}
        </Badge>
      ))}
    </div>
  );
}

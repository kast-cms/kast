'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LayoutGrid, List, Search, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';

interface MediaFiltersProps {
  search: string;
  mimeType: string;
  sort: string;
  view: 'grid' | 'list';
  setSearch: (v: string) => void;
  setMimeType: (v: string) => void;
  setSort: (v: string) => void;
  setView: (v: 'grid' | 'list') => void;
  setShowUpload: (v: boolean) => void;
}

export function MediaFilters({
  search,
  mimeType,
  sort,
  view,
  setSearch,
  setMimeType,
  setSort,
  setView,
  setShowUpload,
}: MediaFiltersProps): JSX.Element {
  const t = useTranslations('mediaLibrary');

  return (
    <div className="flex items-center gap-3 border-b border-[--color-border] px-4 py-2">
      <div className="relative max-w-xs flex-1">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--color-muted-foreground]" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          placeholder={t('searchPlaceholder')}
          className="ps-9"
        />
      </div>

      <Select
        value={mimeType || '_all'}
        onValueChange={(v) => {
          setMimeType(v === '_all' ? '' : v);
        }}
      >
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">{t('filter.allTypes')}</SelectItem>
          <SelectItem value="image/">{t('filter.images')}</SelectItem>
          <SelectItem value="video/">{t('filter.videos')}</SelectItem>
          <SelectItem value="application/">{t('filter.documents')}</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={sort}
        onValueChange={(v) => {
          setSort(v);
        }}
      >
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="createdAt">{t('sort.date')}</SelectItem>
          <SelectItem value="filename">{t('sort.name')}</SelectItem>
          <SelectItem value="size">{t('sort.size')}</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center rounded-md border border-[--color-border]">
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 rounded-e-none ${view === 'grid' ? 'bg-[--color-muted]' : ''}`}
          onClick={() => {
            setView('grid');
          }}
          aria-label="Grid view"
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 rounded-s-none ${view === 'list' ? 'bg-[--color-muted]' : ''}`}
          onClick={() => {
            setView('list');
          }}
          aria-label="List view"
        >
          <List className="h-4 w-4" />
        </Button>
      </div>

      <Button
        className="ms-auto"
        onClick={() => {
          setShowUpload(true);
        }}
      >
        <Upload className="me-2 h-4 w-4" />
        {t('upload')}
      </Button>
    </div>
  );
}

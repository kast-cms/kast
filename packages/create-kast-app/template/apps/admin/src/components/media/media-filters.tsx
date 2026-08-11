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
import { cn } from '@/lib/utils';
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

/** Segmented control: an inactive segment stays flat, the active one lifts onto a card. */
const SEGMENT_BASE = 'size-7 rounded-md';
const SEGMENT_ACTIVE = 'bg-card text-foreground shadow-xs hover:bg-card';
const SEGMENT_INACTIVE = 'text-muted-foreground hover:bg-transparent hover:text-foreground';

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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="w-full sm:max-w-xs">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          startAdornment={<Search />}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
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

        <div className="flex h-9 shrink-0 items-center gap-0.5 rounded-lg bg-muted p-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
            className={cn(SEGMENT_BASE, view === 'grid' ? SEGMENT_ACTIVE : SEGMENT_INACTIVE)}
            onClick={() => {
              setView('grid');
            }}
          >
            <LayoutGrid />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="List view"
            aria-pressed={view === 'list'}
            className={cn(SEGMENT_BASE, view === 'list' ? SEGMENT_ACTIVE : SEGMENT_INACTIVE)}
            onClick={() => {
              setView('list');
            }}
          >
            <List />
          </Button>
        </div>
      </div>

      <Button
        className="sm:ms-auto"
        onClick={() => {
          setShowUpload(true);
        }}
      >
        <Upload />
        {t('upload')}
      </Button>
    </div>
  );
}

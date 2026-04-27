'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';

interface EntryFiltersProps {
  search: string;
  status: string;
  locale: string;
  onSearchChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onLocaleChange: (v: string) => void;
}

export function EntryFilters({
  search,
  status,
  locale,
  onSearchChange,
  onStatusChange,
  onLocaleChange,
}: EntryFiltersProps): JSX.Element {
  const t = useTranslations('content');
  return (
    <div className="flex flex-wrap gap-2">
      <Input
        className="h-8 max-w-xs"
        placeholder={t('searchPlaceholder')}
        value={search}
        onChange={(e) => {
          onSearchChange(e.target.value);
        }}
      />
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="h-8 w-36">
          <SelectValue placeholder={t('allStatuses')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{t('allStatuses')}</SelectItem>
          <SelectItem value="DRAFT">{t('status.DRAFT')}</SelectItem>
          <SelectItem value="PUBLISHED">{t('status.PUBLISHED')}</SelectItem>
          <SelectItem value="ARCHIVED">{t('status.ARCHIVED')}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={locale} onValueChange={onLocaleChange}>
        <SelectTrigger className="h-8 w-36">
          <SelectValue placeholder={t('allLocales')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{t('allLocales')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

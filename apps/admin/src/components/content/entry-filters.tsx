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

const ALL_STATUSES = '__all__';
const ALL_LOCALES = '__all__';

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
      {/* Radix rejects an empty SelectItem value, so "no filter" travels as a
          sentinel and is mapped back to '' for the query. */}
      <Select
        value={status || ALL_STATUSES}
        onValueChange={(v) => {
          onStatusChange(v === ALL_STATUSES ? '' : v);
        }}
      >
        <SelectTrigger className="h-8 w-36">
          <SelectValue placeholder={t('allStatuses')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_STATUSES}>{t('allStatuses')}</SelectItem>
          <SelectItem value="DRAFT">{t('status.DRAFT')}</SelectItem>
          <SelectItem value="PUBLISHED">{t('status.PUBLISHED')}</SelectItem>
          <SelectItem value="ARCHIVED">{t('status.ARCHIVED')}</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={locale || ALL_LOCALES}
        onValueChange={(v) => {
          onLocaleChange(v === ALL_LOCALES ? '' : v);
        }}
      >
        <SelectTrigger className="h-8 w-36">
          <SelectValue placeholder={t('allLocales')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_LOCALES}>{t('allLocales')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

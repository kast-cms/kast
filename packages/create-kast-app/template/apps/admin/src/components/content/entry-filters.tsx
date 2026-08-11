'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';
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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="w-full sm:max-w-xs">
        <Input
          placeholder={t('searchPlaceholder')}
          value={search}
          startAdornment={<Search />}
          aria-label={t('searchPlaceholder')}
          onChange={(e) => {
            onSearchChange(e.target.value);
          }}
        />
      </div>
      {/* Radix rejects an empty SelectItem value, so "no filter" travels as a
          sentinel and is mapped back to '' for the query. */}
      <div className="flex flex-wrap gap-2">
        <Select
          value={status || ALL_STATUSES}
          onValueChange={(v) => {
            onStatusChange(v === ALL_STATUSES ? '' : v);
          }}
        >
          <SelectTrigger className="w-40" aria-label={t('filterStatus')}>
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
          <SelectTrigger className="w-40" aria-label={t('filterLocale')}>
            <SelectValue placeholder={t('allLocales')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_LOCALES}>{t('allLocales')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

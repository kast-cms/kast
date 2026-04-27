'use client';

import { Button } from '@/components/ui/button';
import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, type JSX } from 'react';
import { BulkActionBar } from './bulk-action-bar';
import { EntryFilters } from './entry-filters';
import { EntryTable } from './entry-table';
import { useEntryList } from './use-entry-list';

interface EntryListClientProps {
  typeId: string;
  displayName: string;
}

export function EntryListClient({ typeId, displayName }: EntryListClientProps): JSX.Element {
  const t = useTranslations('content');
  const { session } = useSession();
  const client = createApiClient(session?.accessToken);
  const {
    entries,
    search,
    status,
    locale,
    selected,
    loading,
    setSearch,
    setStatus,
    setLocale,
    toggleSelect,
    toggleAll,
    setEntries,
    setLoading,
    bulkPublish,
    bulkUnpublish,
    bulkTrash,
  } = useEntryList({ typeId });

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params: Record<string, string> = {};
    if (search) params['search'] = search;
    if (status) params['status'] = status;
    if (locale) params['locale'] = locale;
    void client.content
      .list(typeId, params)
      .then((res) => {
        if (!active) return;
        setEntries(res.data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client, typeId, search, status, locale, setEntries, setLoading]);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{displayName}</h1>
          <p className="text-sm text-[--color-muted-foreground]">{t('description')}</p>
        </div>
        <Button asChild size="sm">
          <Link href={`/content/${typeId}/new`}>{t('newEntry')}</Link>
        </Button>
      </div>
      <EntryFilters
        search={search}
        status={status}
        locale={locale}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        onLocaleChange={setLocale}
      />
      {selected.size > 0 && (
        <BulkActionBar
          count={selected.size}
          onPublish={() => {
            void bulkPublish();
          }}
          onUnpublish={() => {
            void bulkUnpublish();
          }}
          onTrash={() => {
            void bulkTrash();
          }}
        />
      )}
      {loading ? (
        <p className="py-8 text-center text-sm text-[--color-muted-foreground]">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm font-medium">{t('emptyTitle')}</p>
          <p className="mt-1 text-sm text-[--color-muted-foreground]">{t('emptyDescription')}</p>
        </div>
      ) : (
        <EntryTable
          typeId={typeId}
          entries={entries}
          selected={selected}
          onToggle={toggleSelect}
          onToggleAll={toggleAll}
        />
      )}
    </div>
  );
}

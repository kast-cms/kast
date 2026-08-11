'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiClient } from '@/lib/session';
import { useApiResource } from '@/lib/use-api-resource';
import { FileText, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, type JSX } from 'react';
import { BulkActionBar } from './bulk-action-bar';
import { EntryFilters } from './entry-filters';
import { EntryTable } from './entry-table';
import { useEntryList } from './use-entry-list';

interface EntryListClientProps {
  typeId: string;
  /**
   * Resolved from the API when omitted. The route used to fetch this on the
   * server, but the content-type route now requires a credential that only
   * exists in the browser session.
   */
  displayName?: string;
}

/** Placeholder rows that mirror the real table's column rhythm. */
function EntryTableSkeleton(): JSX.Element {
  return (
    <div className="divide-y divide-border">
      <div className="h-10 bg-muted/60" />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="size-4 rounded-[0.3rem]" />
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="h-3.5 w-10" />
          <Skeleton className="ms-auto h-3.5 w-20" />
        </div>
      ))}
    </div>
  );
}

export function EntryListClient({ typeId, displayName }: EntryListClientProps): JSX.Element {
  const t = useTranslations('content');
  const client = useApiClient();
  const { data: contentType } = useApiResource(
    async (c) => (await c.contentTypes.get(typeId)).data,
    `content-type:${typeId}`,
  );
  const heading = displayName ?? contentType?.displayName ?? typeId;
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

  const newEntryButton = (
    <Button asChild size="sm">
      <Link href={`/content/${typeId}/new`}>
        <Plus />
        {t('newEntry')}
      </Link>
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={heading} description={t('description')} actions={newEntryButton} />
      <div className="space-y-4">
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
          <Card className="overflow-hidden">
            <EntryTableSkeleton />
          </Card>
        ) : entries.length === 0 ? (
          <EmptyState
            Icon={FileText}
            title={t('emptyTitle')}
            description={t('emptyDescription')}
            action={newEntryButton}
          />
        ) : (
          <Card className="overflow-hidden">
            <EntryTable
              typeId={typeId}
              entries={entries}
              selected={selected}
              onToggle={toggleSelect}
              onToggleAll={toggleAll}
            />
          </Card>
        )}
      </div>
    </div>
  );
}

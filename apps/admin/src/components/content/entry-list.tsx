'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { useApiClient } from '@/lib/session';
import { useApiResource } from '@/lib/use-api-resource';
import type { ImportContentBody, ImportWordPressBody } from '@kast-cms/sdk';
import { Download, FileText, Plus, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useRef, useState, type JSX } from 'react';
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
  const { toast } = useToast();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
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
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          void handleExport();
        }}
      >
        <Download />
        Export JSON
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        loading={importing}
        onClick={() => importInputRef.current?.click()}
      >
        {!importing && <Upload />}
        Import JSON
      </Button>
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void handleImport(file);
        }}
      />
      <Button asChild size="sm">
        <Link href={`/content/${typeId}/new`}>
          <Plus />
          {t('newEntry')}
        </Link>
      </Button>
    </div>
  );

  async function reloadEntries(): Promise<void> {
    const params: Record<string, string> = {};
    if (search) params['search'] = search;
    if (status) params['status'] = status;
    if (locale) params['locale'] = locale;
    const res = await client.content.list(typeId, params);
    setEntries(res.data);
  }

  async function handleExport(): Promise<void> {
    const res = await client.content.export(typeId);
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${typeId}-content-export.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File): Promise<void> {
    setImporting(true);
    try {
      const payload = JSON.parse(await file.text()) as Record<string, unknown>;
      if (Array.isArray(payload['posts'])) {
        await client.content.importWordPress(typeId, payload as unknown as ImportWordPressBody);
      } else if (Array.isArray(payload['entries'])) {
        await client.content.import(typeId, {
          entries: payload['entries'] as ImportContentBody['entries'],
          overwrite: true,
        });
      } else {
        throw new Error('JSON must contain entries or WordPress posts.');
      }
      await reloadEntries();
      toast({ title: 'Content imported' });
    } finally {
      setImporting(false);
    }
  }

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

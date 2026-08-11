'use client';

import { useToast } from '@/components/ui/use-toast';
import { useApiClient } from '@/lib/session';
import type { BulkActionResult, ContentEntrySummary, EntryStatus } from '@kast-cms/sdk';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';

interface UseEntryListParams {
  typeId: string;
}

interface EntryListState {
  entries: ContentEntrySummary[];
  search: string;
  status: string;
  locale: string;
  selected: Set<string>;
  loading: boolean;
  setSearch: (v: string) => void;
  setStatus: (v: string) => void;
  setLocale: (v: string) => void;
  toggleSelect: (id: string) => void;
  toggleAll: (ids: string[]) => void;
  setEntries: (e: ContentEntrySummary[]) => void;
  setLoading: (v: boolean) => void;
  bulkPublish: () => Promise<void>;
  bulkUnpublish: () => Promise<void>;
  bulkTrash: () => Promise<void>;
  clearSelection: () => void;
}

export function useEntryList({ typeId }: UseEntryListParams): EntryListState {
  const client = useApiClient();
  const { toast } = useToast();
  const t = useTranslations('content');
  const [entries, setEntries] = useState<ContentEntrySummary[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [locale, setLocale] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  function toggleSelect(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(ids: string[]): void {
    setSelected((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(ids);
    });
  }

  function clearSelection(): void {
    setSelected(new Set());
  }

  /**
   * Bulk routes are per-item and NOT atomic: one entry blocked by the SEO or
   * schema gate leaves the rest applied. Only the ids the server reports as `ok`
   * may be updated locally, and the failures have to be shown or a blocked
   * publish looks like it worked until the next reload.
   */
  const applyBulk = useCallback(
    (result: BulkActionResult, apply: (okIds: Set<string>) => void): void => {
      const okIds = new Set(result.results.filter((r) => r.ok).map((r) => r.id));
      apply(okIds);
      if (result.failed > 0) {
        const first = result.results.find((r) => !r.ok);
        toast({
          variant: 'destructive',
          title: t('bulkPartial', { failed: result.failed, succeeded: result.succeeded }),
          ...(first?.error ? { description: first.error.message } : {}),
        });
      }
      clearSelection();
    },
    [toast, t],
  );

  const bulkPublish = useCallback(async (): Promise<void> => {
    const { data } = await client.content.bulkPublish(typeId, [...selected]);
    applyBulk(data, (ok) => {
      setEntries((prev) =>
        prev.map((e) => (ok.has(e.id) ? { ...e, status: 'PUBLISHED' as EntryStatus } : e)),
      );
    });
  }, [client, selected, typeId, applyBulk]);

  const bulkUnpublish = useCallback(async (): Promise<void> => {
    const { data } = await client.content.bulkUnpublish(typeId, [...selected]);
    applyBulk(data, (ok) => {
      setEntries((prev) =>
        prev.map((e) => (ok.has(e.id) ? { ...e, status: 'DRAFT' as EntryStatus } : e)),
      );
    });
  }, [client, selected, typeId, applyBulk]);

  const bulkTrash = useCallback(async (): Promise<void> => {
    const { data } = await client.content.bulkTrash(typeId, [...selected]);
    applyBulk(data, (ok) => {
      setEntries((prev) => prev.filter((e) => !ok.has(e.id)));
    });
  }, [client, selected, typeId, applyBulk]);

  return {
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
    clearSelection,
  };
}

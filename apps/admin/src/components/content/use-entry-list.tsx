'use client';

import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { ContentEntrySummary, EntryStatus } from '@kast/sdk';
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
  const { session } = useSession();
  const client = createApiClient(session?.accessToken);
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

  const bulkPublish = useCallback(async (): Promise<void> => {
    const ids = [...selected];
    await client.content.bulkPublish(typeId, ids);
    setEntries((prev) =>
      prev.map((e) => (selected.has(e.id) ? { ...e, status: 'PUBLISHED' as EntryStatus } : e)),
    );
    clearSelection();
  }, [client, selected, typeId]);

  const bulkUnpublish = useCallback(async (): Promise<void> => {
    const ids = [...selected];
    await client.content.bulkUnpublish(typeId, ids);
    setEntries((prev) =>
      prev.map((e) => (selected.has(e.id) ? { ...e, status: 'DRAFT' as EntryStatus } : e)),
    );
    clearSelection();
  }, [client, selected, typeId]);

  const bulkTrash = useCallback(async (): Promise<void> => {
    const ids = [...selected];
    await client.content.bulkTrash(typeId, ids);
    setEntries((prev) => prev.filter((e) => !selected.has(e.id)));
    clearSelection();
  }, [client, selected, typeId]);

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

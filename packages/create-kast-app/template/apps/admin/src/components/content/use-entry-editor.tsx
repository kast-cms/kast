'use client';

import { useApiClient } from '@/lib/session';
import type { ContentEntryDetail, EntryStatus, KastClient } from '@kast-cms/sdk';
import { useCallback, useEffect, useRef, useState } from 'react';
import { buildSeoMetaBody } from './seo-meta-body';

interface UseEntryEditorParams {
  typeId: string;
  entryId: string | null;
  initialEntry: ContentEntryDetail | null;
}

interface EntryEditorState {
  data: Record<string, unknown>;
  seo: Record<string, string>;
  status: EntryStatus;
  scheduledAt: string | null;
  isSaving: boolean;
  isPublishing: boolean;
  isUnpublishing: boolean;
  isArchiving: boolean;
  isRestoring: boolean;
  isScheduling: boolean;
  isCancellingSchedule: boolean;
  isReverting: boolean;
  autosaved: boolean;
  setData: (key: string, value: unknown) => void;
  setSeo: (key: string, value: string) => void;
  saveDraft: () => Promise<void>;
  publish: (force?: boolean) => Promise<void>;
  unpublish: () => Promise<void>;
  archive: () => Promise<void>;
  restore: () => Promise<void>;
  schedulePublish: (publishAt: string) => Promise<void>;
  cancelSchedule: () => Promise<void>;
  revertToVersion: (versionId: string) => Promise<void>;
  createdEntryId: string | null;
}

function extractSeo(d: Record<string, unknown>): Record<string, string> {
  const seo = d['_seo'];
  if (seo && typeof seo === 'object' && !Array.isArray(seo)) {
    const s = seo as Record<string, unknown>;
    return {
      metaTitle: typeof s['metaTitle'] === 'string' ? s['metaTitle'] : '',
      metaDescription: typeof s['metaDescription'] === 'string' ? s['metaDescription'] : '',
      canonicalUrl: typeof s['canonicalUrl'] === 'string' ? s['canonicalUrl'] : '',
      ogImage: typeof s['ogImage'] === 'string' ? s['ogImage'] : '',
    };
  }
  return { metaTitle: '', metaDescription: '', canonicalUrl: '', ogImage: '' };
}

function stripSeo(d: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...d };
  delete copy['_seo'];
  return copy;
}

interface PersistEntryParams {
  client: KastClient;
  typeId: string;
  entryId: string | null;
  data: Record<string, unknown>;
  seo: Record<string, string>;
  status?: EntryStatus;
}

/**
 * Writes the entry, creating it when it has no id yet, and returns the id.
 *
 * The `_seo` block inside `data` is the editor's own copy of the panel. The
 * SeoMeta row — what the delivery API serves and what the publish gate scores —
 * only exists once it is written through PUT /seo/meta, and a field the user
 * emptied only clears there when it is sent as null.
 */
async function persistEntry({
  client,
  typeId,
  entryId,
  data,
  seo,
  status,
}: PersistEntryParams): Promise<string> {
  const payload = { ...data, _seo: seo };
  let id = entryId;
  if (id === null) {
    const res = await client.content.create(typeId, { data: payload });
    id = res.data.id;
  } else if (status === undefined) {
    await client.content.update(typeId, id, { data: payload });
  } else {
    await client.content.update(typeId, id, { data: payload, status });
  }
  await client.seo.upsertMeta(id, buildSeoMetaBody(seo));
  return id;
}

async function withFlag<T>(setFlag: (b: boolean) => void, fn: () => Promise<T>): Promise<T> {
  setFlag(true);
  try {
    return await fn();
  } finally {
    setFlag(false);
  }
}

interface UseAutosaveParams {
  typeId: string;
  createdEntryId: string | null;
  seo: Record<string, string>;
  status: EntryStatus;
  data: Record<string, unknown>;
  client: KastClient;
  setCreatedEntryId: (id: string) => void;
  setAutosaved: (v: boolean) => void;
}

function useAutosave({
  typeId,
  createdEntryId,
  seo,
  status,
  data,
  client,
  setCreatedEntryId,
  setAutosaved,
}: UseAutosaveParams): void {
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const persistDraft = useCallback(async (): Promise<void> => {
    if (status === 'PUBLISHED') return;
    const id = await persistEntry({
      client,
      typeId,
      entryId: createdEntryId,
      data: dataRef.current,
      seo,
    });
    setCreatedEntryId(id);
    setAutosaved(true);
  }, [client, createdEntryId, seo, status, typeId, setCreatedEntryId, setAutosaved]);
  useEffect(() => {
    const timer = setTimeout(() => {
      void persistDraft();
    }, 30000);
    return () => clearTimeout(timer);
  }, [data, seo, persistDraft]);
}

export function useEntryEditor({
  typeId,
  entryId,
  initialEntry,
}: UseEntryEditorParams): EntryEditorState {
  const client = useApiClient();
  const [data, setDataState] = useState<Record<string, unknown>>(
    initialEntry ? stripSeo(initialEntry.data) : {},
  );
  const [seo, setSeoState] = useState<Record<string, string>>(
    initialEntry
      ? extractSeo(initialEntry.data)
      : { metaTitle: '', metaDescription: '', canonicalUrl: '', ogImage: '' },
  );
  const [status, setStatus] = useState<EntryStatus>(initialEntry?.status ?? 'DRAFT');
  const [scheduledAt, setScheduledAt] = useState<string | null>(initialEntry?.scheduledAt ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isCancellingSchedule, setIsCancellingSchedule] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [autosaved, setAutosaved] = useState(false);
  const [createdEntryId, setCreatedEntryId] = useState<string | null>(entryId);
  useAutosave({
    typeId,
    createdEntryId,
    seo,
    status,
    data,
    client,
    setCreatedEntryId,
    setAutosaved,
  });

  function setData(key: string, value: unknown): void {
    setAutosaved(false);
    setDataState((prev) => ({ ...prev, [key]: value }));
  }
  function setSeo(key: string, value: string): void {
    setAutosaved(false);
    setSeoState((prev) => ({ ...prev, [key]: value }));
  }
  async function saveDraft(): Promise<void> {
    setIsSaving(true);
    try {
      const id = await persistEntry({
        client,
        typeId,
        entryId: createdEntryId,
        data,
        seo,
        status: 'DRAFT',
      });
      setCreatedEntryId(id);
      setStatus('DRAFT');
      setAutosaved(true);
    } finally {
      setIsSaving(false);
    }
  }
  /**
   * `force` overrides the SEO gate's WARNING tier (the API refuses ERROR-tier
   * issues either way). The caller passes it after the user confirms the
   * warnings the first attempt reported.
   */
  async function publish(force = false): Promise<void> {
    setIsPublishing(true);
    try {
      // The SEO row has to be current before the gate scores it.
      const id = await persistEntry({ client, typeId, entryId: createdEntryId, data, seo });
      setCreatedEntryId(id);
      await client.content.publish(typeId, id, force ? { force: true } : {});
      setStatus('PUBLISHED');
    } finally {
      setIsPublishing(false);
    }
  }
  async function unpublish(): Promise<void> {
    if (!createdEntryId) return;
    await withFlag(setIsUnpublishing, () => client.content.unpublish(typeId, createdEntryId));
    setStatus('DRAFT');
  }
  async function archive(): Promise<void> {
    if (!createdEntryId) return;
    await withFlag(setIsArchiving, () => client.content.archive(typeId, createdEntryId));
    setStatus('ARCHIVED');
  }
  async function restore(): Promise<void> {
    if (!createdEntryId) return;
    await withFlag(setIsRestoring, () => client.content.unarchive(typeId, createdEntryId));
    setStatus('DRAFT');
  }
  async function schedulePublish(publishAt: string): Promise<void> {
    if (!createdEntryId) return;
    const res = await withFlag(setIsScheduling, () =>
      client.content.schedulePublish(typeId, createdEntryId, { publishAt }),
    );
    setStatus('SCHEDULED');
    setScheduledAt(res.data.scheduledAt);
  }
  async function cancelSchedule(): Promise<void> {
    if (!createdEntryId) return;
    await withFlag(setIsCancellingSchedule, () =>
      client.content.cancelSchedule(typeId, createdEntryId),
    );
    setStatus('DRAFT');
    setScheduledAt(null);
  }
  async function revertToVersion(versionId: string): Promise<void> {
    if (!createdEntryId) return;
    setIsReverting(true);
    try {
      const res = await client.content.revert(typeId, createdEntryId, versionId);
      setDataState(stripSeo(res.data.data));
      setSeoState(extractSeo(res.data.data));
      setStatus('DRAFT');
      setAutosaved(false);
    } finally {
      setIsReverting(false);
    }
  }
  return {
    data,
    seo,
    status,
    scheduledAt,
    isSaving,
    isPublishing,
    isUnpublishing,
    isArchiving,
    isRestoring,
    isScheduling,
    isCancellingSchedule,
    autosaved,
    setData,
    setSeo,
    saveDraft,
    publish,
    unpublish,
    archive,
    restore,
    schedulePublish,
    cancelSchedule,
    revertToVersion,
    isReverting,
    createdEntryId,
  };
}

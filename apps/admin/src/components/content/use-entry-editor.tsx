'use client';

import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { ContentEntryDetail, EntryStatus } from '@kast/sdk';
import { useCallback, useEffect, useRef, useState } from 'react';

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
  publish: () => Promise<void>;
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
  client: ReturnType<typeof createApiClient>;
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
    const payload = { ...dataRef.current, _seo: seo };
    if (createdEntryId) {
      await client.content.update(typeId, createdEntryId, { data: payload });
    } else {
      const res = await client.content.create(typeId, { data: payload, status: 'DRAFT' });
      setCreatedEntryId(res.data.id);
    }
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
  const { session } = useSession();
  const client = createApiClient(session?.accessToken);
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
      const payload = { ...data, _seo: seo };
      if (createdEntryId) {
        await client.content.update(typeId, createdEntryId, { data: payload, status: 'DRAFT' });
      } else {
        const res = await client.content.create(typeId, { data: payload, status: 'DRAFT' });
        setCreatedEntryId(res.data.id);
      }
      setStatus('DRAFT');
      setAutosaved(true);
    } finally {
      setIsSaving(false);
    }
  }
  async function publish(): Promise<void> {
    setIsPublishing(true);
    try {
      const payload = { ...data, _seo: seo };
      let id = createdEntryId;
      if (!id) {
        const res = await client.content.create(typeId, { data: payload, status: 'DRAFT' });
        id = res.data.id;
        setCreatedEntryId(id);
      } else {
        await client.content.update(typeId, id, { data: payload });
      }
      await client.content.publish(typeId, id);
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
    await withFlag(setIsRestoring, () => client.content.restore(typeId, createdEntryId));
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

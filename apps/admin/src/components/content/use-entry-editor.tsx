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
  const [autosaved, setAutosaved] = useState(false);
  const [createdEntryId, setCreatedEntryId] = useState<string | null>(entryId);
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  }, [client, createdEntryId, seo, status, typeId]);

  useEffect(() => {
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(() => {
      void persistDraft();
    }, 30000);
    return () => {
      if (autosaveRef.current) clearTimeout(autosaveRef.current);
    };
  }, [data, seo, persistDraft]);

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
    setIsUnpublishing(true);
    await client.content.unpublish(typeId, createdEntryId).finally(() => {
      setIsUnpublishing(false);
    });
    setStatus('DRAFT');
  }

  async function archive(): Promise<void> {
    if (!createdEntryId) return;
    setIsArchiving(true);
    await client.content.archive(typeId, createdEntryId).finally(() => {
      setIsArchiving(false);
    });
    setStatus('ARCHIVED');
  }

  async function restore(): Promise<void> {
    if (!createdEntryId) return;
    setIsRestoring(true);
    await client.content.restore(typeId, createdEntryId).finally(() => {
      setIsRestoring(false);
    });
    setStatus('DRAFT');
  }

  async function schedulePublish(publishAt: string): Promise<void> {
    if (!createdEntryId) return;
    setIsScheduling(true);
    const res = await client.content
      .schedulePublish(typeId, createdEntryId, { publishAt })
      .finally(() => {
        setIsScheduling(false);
      });
    setStatus('SCHEDULED');
    setScheduledAt(res.data.scheduledAt);
  }

  async function cancelSchedule(): Promise<void> {
    if (!createdEntryId) return;
    setIsCancellingSchedule(true);
    await client.content.cancelSchedule(typeId, createdEntryId).finally(() => {
      setIsCancellingSchedule(false);
    });
    setStatus('DRAFT');
    setScheduledAt(null);
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
    createdEntryId,
  };
}

'use client';

import { Label } from '@/components/ui/label';
import type { ContentEntryDetail, ContentTypeDetail } from '@kast/sdk';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type JSX } from 'react';
import { ActionBar } from './action-bar';
import { FieldRenderer } from './field-renderer';
import { SeoPanel } from './seo-panel';
import { useEntryEditor } from './use-entry-editor';
import { VersionPanel } from './version-panel';

function getEffectiveEntryId(
  entryId: string | null | undefined,
  created: string | null,
): string | null {
  if (entryId) return entryId;
  return created;
}

interface EntryEditorProps {
  typeId: string;
  contentType: ContentTypeDetail;
  entry: ContentEntryDetail | null;
}

export function EntryEditor({ typeId, contentType, entry }: EntryEditorProps): JSX.Element {
  const router = useRouter();
  const t = useTranslations('content.editor');
  const {
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
    isReverting,
    revertToVersion,
    createdEntryId,
    setData,
    setSeo,
    saveDraft,
    publish,
    unpublish,
    archive,
    restore,
    schedulePublish,
    cancelSchedule,
  } = useEntryEditor({ typeId, entryId: entry?.id ?? null, initialEntry: entry });

  const [versionPanelOpen, setVersionPanelOpen] = useState(false);
  const effectiveEntryId = getEffectiveEntryId(entry?.id, createdEntryId);

  async function handleSaveDraft(): Promise<void> {
    await saveDraft();
    router.refresh();
  }

  async function handlePublish(): Promise<void> {
    await publish();
    router.refresh();
  }

  async function handleUnpublish(): Promise<void> {
    await unpublish();
    router.refresh();
  }

  async function handleArchive(): Promise<void> {
    await archive();
    router.refresh();
  }

  async function handleRestore(): Promise<void> {
    await restore();
    router.refresh();
  }

  async function handleSchedule(publishAt: string): Promise<void> {
    await schedulePublish(publishAt);
    router.refresh();
  }

  async function handleCancelSchedule(): Promise<void> {
    await cancelSchedule();
    router.refresh();
  }

  const busy = [isSaving, isPublishing, isUnpublishing, isArchiving, isRestoring].some(Boolean);
  const { metaTitle = '', metaDescription = '', canonicalUrl = '', ogImage = '' } = seo;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{entry ? t('editTitle') : t('newTitle')}</h1>
        {autosaved && (
          <span className="text-xs text-[--color-muted-foreground]">{t('autosaved')}</span>
        )}
      </div>
      <ActionBar
        status={status}
        isSaving={isSaving}
        isPublishing={isPublishing}
        isUnpublishing={isUnpublishing}
        isArchiving={isArchiving}
        isRestoring={isRestoring}
        isScheduling={isScheduling}
        isCancellingSchedule={isCancellingSchedule}
        scheduledAt={scheduledAt}
        onSaveDraft={() => {
          void handleSaveDraft();
        }}
        onPublish={() => {
          void handlePublish();
        }}
        onUnpublish={() => {
          void handleUnpublish();
        }}
        onArchive={() => {
          void handleArchive();
        }}
        onRestore={() => {
          void handleRestore();
        }}
        onSchedule={(at) => {
          void handleSchedule(at);
        }}
        onCancelSchedule={() => {
          void handleCancelSchedule();
        }}
        onOpenVersions={() => {
          setVersionPanelOpen(true);
        }}
      />
      <div className="space-y-6 rounded-lg border border-[--color-border] p-6">
        {contentType.fields.map((field) => (
          <div key={field.id} className="space-y-1">
            <Label htmlFor={`field-${field.name}`}>
              {field.displayName}
              {field.isRequired && <span className="ms-1 text-[--color-destructive]">*</span>}
            </Label>
            <FieldRenderer
              field={field}
              value={data[field.name]}
              onChange={(val) => {
                setData(field.name, val);
              }}
              disabled={busy}
            />
          </div>
        ))}
      </div>
      <SeoPanel
        metaTitle={metaTitle}
        metaDescription={metaDescription}
        canonicalUrl={canonicalUrl}
        ogImage={ogImage}
        onChange={setSeo}
        disabled={busy}
      />
      <VersionPanel
        typeId={typeId}
        entryId={effectiveEntryId}
        open={versionPanelOpen}
        onClose={() => {
          setVersionPanelOpen(false);
        }}
        onRevert={revertToVersion}
        isReverting={isReverting}
      />
    </div>
  );
}

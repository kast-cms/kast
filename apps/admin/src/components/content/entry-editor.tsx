'use client';

import { Label } from '@/components/ui/label';
import type { ContentEntryDetail, ContentTypeDetail } from '@kast/sdk';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { JSX } from 'react';
import { ActionBar } from './action-bar';
import { FieldRenderer } from './field-renderer';
import { SeoPanel } from './seo-panel';
import { useEntryEditor } from './use-entry-editor';

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
    autosaved,
    setData,
    setSeo,
    setScheduledAt,
    saveDraft,
    publish,
    unpublish,
  } = useEntryEditor({ typeId, entryId: entry?.id ?? null, initialEntry: entry });

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
        scheduledAt={scheduledAt}
        onScheduledAtChange={setScheduledAt}
        onSaveDraft={() => {
          void handleSaveDraft();
        }}
        onPublish={() => {
          void handlePublish();
        }}
        onUnpublish={() => {
          void handleUnpublish();
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
              disabled={isSaving || isPublishing}
            />
          </div>
        ))}
      </div>
      <SeoPanel
        metaTitle={seo['metaTitle'] ?? ''}
        metaDescription={seo['metaDescription'] ?? ''}
        canonicalUrl={seo['canonicalUrl'] ?? ''}
        ogImage={seo['ogImage'] ?? ''}
        onChange={setSeo}
        disabled={isSaving || isPublishing}
      />
    </div>
  );
}

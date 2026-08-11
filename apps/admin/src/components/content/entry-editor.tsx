'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';
import type { ContentEntryDetail, ContentTypeDetail, KastApiError } from '@kast-cms/sdk';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type JSX } from 'react';
import { ActionBar } from './action-bar';
import { FieldRenderer } from './field-renderer';
import { SeoPanel } from './seo-panel';
import { SeoWarningDialog } from './seo-warning-dialog';
import { toSeoWarnings, type SeoWarning } from './seo-warnings';
import { useEntryEditor } from './use-entry-editor';
import { VersionPanel } from './version-panel';

function getEffectiveEntryId(
  entryId: string | null | undefined,
  created: string | null,
): string | null {
  if (entryId) return entryId;
  return created;
}

interface SeoFields {
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  ogImage: string;
}

/** The editor keeps SEO as a loose record; the panel wants four defined strings. */
function getSeoFields(seo: Record<string, string>): SeoFields {
  const { metaTitle = '', metaDescription = '', canonicalUrl = '', ogImage = '' } = seo;
  return { metaTitle, metaDescription, canonicalUrl, ogImage };
}

interface EditorHeaderProps {
  isEditing: boolean;
  autosaved: boolean;
}

function EditorHeader({ isEditing, autosaved }: EditorHeaderProps): JSX.Element {
  const t = useTranslations('content.editor');
  return (
    <PageHeader
      title={isEditing ? t('editTitle') : t('newTitle')}
      actions={
        autosaved ? (
          <Badge variant="success" dot>
            {t('autosaved')}
          </Badge>
        ) : undefined
      }
    />
  );
}

interface FieldsCardProps {
  contentType: ContentTypeDetail;
  data: Record<string, unknown>;
  onFieldChange: (name: string, value: unknown) => void;
  disabled: boolean;
}

/** The content type's own fields, one control per field definition. */
function FieldsCard({ contentType, data, onFieldChange, disabled }: FieldsCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{contentType.displayName}</CardTitle>
        {contentType.description !== null && contentType.description !== '' && (
          <CardDescription>{contentType.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        {contentType.fields.map((field) => {
          // A lone switch under a stacked label reads as unfinished, so
          // booleans get a row treatment instead.
          const isToggle = field.type === 'BOOLEAN';
          return (
            <div
              key={field.id}
              className={cn(
                isToggle
                  ? 'flex items-center justify-between gap-4 rounded-lg border border-border px-3.5 py-3'
                  : 'space-y-2',
              )}
            >
              <Label htmlFor={`field-${field.name}`} required={field.isRequired}>
                {field.displayName}
              </Label>
              <FieldRenderer
                field={field}
                value={data[field.name]}
                onChange={(val) => {
                  onFieldChange(field.name, val);
                }}
                disabled={disabled}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

interface EntryEditorProps {
  typeId: string;
  contentType: ContentTypeDetail;
  entry: ContentEntryDetail | null;
}

export function EntryEditor({ typeId, contentType, entry }: EntryEditorProps): JSX.Element {
  const router = useRouter();
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
  const [seoWarnings, setSeoWarnings] = useState<SeoWarning[] | null>(null);
  const effectiveEntryId = getEffectiveEntryId(entry?.id, createdEntryId);

  async function handleSaveDraft(): Promise<void> {
    await saveDraft();
    router.refresh();
  }

  /**
   * A warning-tier SEO failure is a question, not an error: the API blocks the
   * publish and tells the caller it can be overridden. Catching that one code
   * turns it into the confirm dialog; every other failure keeps propagating.
   */
  async function handlePublish(force = false): Promise<void> {
    try {
      await publish(force);
    } catch (err) {
      const e = err as KastApiError;
      if (e.code !== 'SEO_VALIDATION_WARNINGS') throw err;
      setSeoWarnings(toSeoWarnings(e.details));
      return;
    }
    setSeoWarnings(null);
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
  const { metaTitle, metaDescription, canonicalUrl, ogImage } = getSeoFields(seo);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <EditorHeader isEditing={entry !== null} autosaved={autosaved} />
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
      <SeoWarningDialog
        open={seoWarnings !== null}
        warnings={seoWarnings ?? []}
        isPublishing={isPublishing}
        onConfirm={() => {
          void handlePublish(true);
        }}
        onCancel={() => {
          setSeoWarnings(null);
        }}
      />
      <FieldsCard contentType={contentType} data={data} onFieldChange={setData} disabled={busy} />
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

'use client';

import { Button } from '@/components/ui/button';
import type { EntryStatus } from '@kast/sdk';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';
import { ScheduleDialog } from './schedule-dialog';

interface ActionBarProps {
  status: EntryStatus;
  isSaving: boolean;
  isPublishing: boolean;
  isUnpublishing: boolean;
  isArchiving: boolean;
  isRestoring: boolean;
  isScheduling: boolean;
  isCancellingSchedule: boolean;
  scheduledAt: string | null;
  onSaveDraft: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onSchedule: (publishAt: string) => void;
  onCancelSchedule: () => void;
}

export function ActionBar({
  status,
  isSaving,
  isPublishing,
  isUnpublishing,
  isArchiving,
  isRestoring,
  isScheduling,
  isCancellingSchedule,
  scheduledAt,
  onSaveDraft,
  onPublish,
  onUnpublish,
  onArchive,
  onRestore,
  onSchedule,
  onCancelSchedule,
}: ActionBarProps): JSX.Element {
  const t = useTranslations('content.editor');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const busy = [
    isSaving,
    isPublishing,
    isUnpublishing,
    isArchiving,
    isRestoring,
    isScheduling,
    isCancellingSchedule,
  ].some(Boolean);

  const draftActions = (): JSX.Element => (
    <>
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onSaveDraft}>
        {isSaving ? t('saving') : t('saveDraft')}
      </Button>
      <Button type="button" size="sm" disabled={busy} onClick={onPublish}>
        {isPublishing ? t('publishing') : t('publish')}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => {
          setScheduleOpen(true);
        }}
      >
        {t('schedule')}
      </Button>
    </>
  );

  const publishedActions = (): JSX.Element => (
    <>
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onUnpublish}>
        {isUnpublishing ? t('unpublishing') : t('unpublish')}
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onArchive}>
        {isArchiving ? t('archiving') : t('archive')}
      </Button>
    </>
  );

  const archivedActions = (): JSX.Element => (
    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onRestore}>
      {isRestoring ? t('restoring') : t('restore')}
    </Button>
  );

  const scheduledActions = (): JSX.Element => (
    <>
      {scheduledAt && (
        <span className="text-xs text-[--color-muted-foreground]">
          {t('scheduledFor', { date: new Date(scheduledAt).toLocaleString() })}
        </span>
      )}
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onCancelSchedule}>
        {isCancellingSchedule ? t('cancelling') : t('cancelSchedule')}
      </Button>
    </>
  );

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[--color-border] p-3">
      {status === 'DRAFT' && draftActions()}
      {status === 'PUBLISHED' && publishedActions()}
      {status === 'ARCHIVED' && archivedActions()}
      {status === 'SCHEDULED' && scheduledActions()}
      <ScheduleDialog
        open={scheduleOpen}
        isSubmitting={isScheduling}
        onConfirm={(publishAt) => {
          setScheduleOpen(false);
          onSchedule(publishAt);
        }}
        onCancel={() => {
          setScheduleOpen(false);
        }}
      />
    </div>
  );
}

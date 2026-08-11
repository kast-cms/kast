'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Hint } from '@/components/ui/tooltip';
import type { EntryStatus } from '@kast-cms/sdk';
import { Archive, CalendarClock, EyeOff, History, RotateCcw, Save, Send, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';
import { ScheduleDialog } from './schedule-dialog';
import { StatusBadge } from './status-badge';

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
  onOpenVersions: () => void;
}

/*
 * The bar shows a different set of actions per editorial state. Each state gets
 * its own component rather than an inline render function, so the states stay
 * readable side by side and the parent keeps to routing between them.
 */

interface DraftActionsProps {
  busy: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
  onOpenSchedule: () => void;
}

function DraftActions({
  busy,
  isSaving,
  isPublishing,
  onSaveDraft,
  onPublish,
  onOpenSchedule,
}: DraftActionsProps): JSX.Element {
  const t = useTranslations('content.editor');
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        loading={isSaving}
        onClick={onSaveDraft}
      >
        {!isSaving && <Save />}
        {isSaving ? t('saving') : t('saveDraft')}
      </Button>
      <Button type="button" size="sm" disabled={busy} loading={isPublishing} onClick={onPublish}>
        {!isPublishing && <Send />}
        {isPublishing ? t('publishing') : t('publish')}
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onOpenSchedule}>
        <CalendarClock />
        {t('schedule')}
      </Button>
    </>
  );
}

interface PublishedActionsProps {
  busy: boolean;
  isUnpublishing: boolean;
  isArchiving: boolean;
  onUnpublish: () => void;
  onArchive: () => void;
}

function PublishedActions({
  busy,
  isUnpublishing,
  isArchiving,
  onUnpublish,
  onArchive,
}: PublishedActionsProps): JSX.Element {
  const t = useTranslations('content.editor');
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        loading={isUnpublishing}
        onClick={onUnpublish}
      >
        {!isUnpublishing && <EyeOff />}
        {isUnpublishing ? t('unpublishing') : t('unpublish')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busy}
        loading={isArchiving}
        onClick={onArchive}
      >
        {!isArchiving && <Archive />}
        {isArchiving ? t('archiving') : t('archive')}
      </Button>
    </>
  );
}

function ArchivedActions({
  busy,
  isRestoring,
  onRestore,
}: {
  busy: boolean;
  isRestoring: boolean;
  onRestore: () => void;
}): JSX.Element {
  const t = useTranslations('content.editor');
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={busy}
      loading={isRestoring}
      onClick={onRestore}
    >
      {!isRestoring && <RotateCcw />}
      {isRestoring ? t('restoring') : t('restore')}
    </Button>
  );
}

interface ScheduledActionsProps {
  busy: boolean;
  isCancellingSchedule: boolean;
  scheduledAt: string | null;
  onCancelSchedule: () => void;
}

function ScheduledActions({
  busy,
  isCancellingSchedule,
  scheduledAt,
  onCancelSchedule,
}: ScheduledActionsProps): JSX.Element {
  const t = useTranslations('content.editor');
  return (
    <>
      {scheduledAt !== null && (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5 text-info" />
          {t('scheduledFor', { date: new Date(scheduledAt).toLocaleString() })}
        </span>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        loading={isCancellingSchedule}
        onClick={onCancelSchedule}
      >
        {!isCancellingSchedule && <X />}
        {isCancellingSchedule ? t('cancelling') : t('cancelSchedule')}
      </Button>
    </>
  );
}

export function ActionBar(props: ActionBarProps): JSX.Element {
  const { status, scheduledAt, onSchedule, onOpenVersions, isScheduling } = props;
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Any in-flight mutation disables the whole bar, so two actions can never
  // race against the same entry.
  const busy = [
    props.isSaving,
    props.isPublishing,
    props.isUnpublishing,
    props.isArchiving,
    props.isRestoring,
    props.isScheduling,
    props.isCancellingSchedule,
  ].some(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 shadow-xs">
      <StatusBadge status={status} />
      <Separator orientation="vertical" className="mx-1 h-5" />

      {status === 'DRAFT' && (
        <DraftActions
          busy={busy}
          isSaving={props.isSaving}
          isPublishing={props.isPublishing}
          onSaveDraft={props.onSaveDraft}
          onPublish={props.onPublish}
          onOpenSchedule={() => {
            setScheduleOpen(true);
          }}
        />
      )}
      {status === 'PUBLISHED' && (
        <PublishedActions
          busy={busy}
          isUnpublishing={props.isUnpublishing}
          isArchiving={props.isArchiving}
          onUnpublish={props.onUnpublish}
          onArchive={props.onArchive}
        />
      )}
      {status === 'ARCHIVED' && (
        <ArchivedActions busy={busy} isRestoring={props.isRestoring} onRestore={props.onRestore} />
      )}
      {status === 'SCHEDULED' && (
        <ScheduledActions
          busy={busy}
          isCancellingSchedule={props.isCancellingSchedule}
          scheduledAt={scheduledAt}
          onCancelSchedule={props.onCancelSchedule}
        />
      )}

      <Hint label="Version history">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="ms-auto"
          onClick={onOpenVersions}
          aria-label="Version history"
        >
          <History />
        </Button>
      </Hint>

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

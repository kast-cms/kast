'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { EntryStatus } from '@kast/sdk';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';

interface ActionBarProps {
  status: EntryStatus;
  isSaving: boolean;
  isPublishing: boolean;
  isUnpublishing: boolean;
  scheduledAt: string;
  onScheduledAtChange: (val: string) => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
}

export function ActionBar({
  status,
  isSaving,
  isPublishing,
  isUnpublishing,
  scheduledAt,
  onScheduledAtChange,
  onSaveDraft,
  onPublish,
  onUnpublish,
}: ActionBarProps): JSX.Element {
  const t = useTranslations('content.editor');
  const busy = isSaving || isPublishing || isUnpublishing;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[--color-border] p-3">
      <div className="flex flex-1 items-center gap-2">
        <label className="text-xs text-[--color-muted-foreground]" htmlFor="schedule-at">
          {t('scheduledAt')}
        </label>
        <Input
          id="schedule-at"
          type="datetime-local"
          className="h-7 w-44 text-xs"
          value={scheduledAt}
          onChange={(e) => {
            onScheduledAtChange(e.target.value);
          }}
          disabled={busy}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => {
          onSaveDraft();
        }}
      >
        {isSaving ? t('saving') : t('saveDraft')}
      </Button>
      {status === 'PUBLISHED' ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => {
            onUnpublish();
          }}
        >
          {isUnpublishing ? t('unpublishing') : t('unpublish')}
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={() => {
            onPublish();
          }}
        >
          {isPublishing ? t('publishing') : t('publish')}
        </Button>
      )}
    </div>
  );
}

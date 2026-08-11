'use client';

import { Button } from '@/components/ui/button';
import { CheckCircle2, EyeOff, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';

interface BulkActionBarProps {
  count: number;
  onPublish: () => void;
  onUnpublish: () => void;
  onTrash: () => void;
}

export function BulkActionBar({
  count,
  onPublish,
  onUnpublish,
  onTrash,
}: BulkActionBarProps): JSX.Element {
  const t = useTranslations('content.bulk');
  return (
    <div
      role="toolbar"
      aria-label={t('selected', { count })}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/25 bg-primary-subtle px-4 py-2.5 shadow-xs"
    >
      <span className="text-sm font-medium text-primary-subtle-foreground">
        {t('selected', { count })}
      </span>
      <div className="ms-auto flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="success" onClick={onPublish}>
          <CheckCircle2 />
          {t('publish')}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onUnpublish}>
          <EyeOff />
          {t('unpublish')}
        </Button>
        <Button type="button" size="sm" variant="ghost-destructive" onClick={onTrash}>
          <Trash2 />
          {t('trash')}
        </Button>
      </div>
    </div>
  );
}

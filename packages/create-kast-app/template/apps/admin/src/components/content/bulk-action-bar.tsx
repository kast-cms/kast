'use client';

import { Button } from '@/components/ui/button';
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
    <div className="flex items-center gap-3 rounded-md bg-[--color-muted] px-4 py-2">
      <span className="text-sm font-medium">{t('selected', { count })}</span>
      <div className="ms-auto flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onPublish}>
          {t('publish')}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onUnpublish}>
          {t('unpublish')}
        </Button>
        <Button type="button" size="sm" variant="destructive" onClick={onTrash}>
          {t('trash')}
        </Button>
      </div>
    </div>
  );
}

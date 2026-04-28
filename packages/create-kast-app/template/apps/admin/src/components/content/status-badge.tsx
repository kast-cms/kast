'use client';

import { Badge } from '@/components/ui/badge';
import type { EntryStatus } from '@kast-cms/sdk';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';

const STATUS_CLASS: Record<EntryStatus, string> = {
  DRAFT: 'bg-[--color-muted] text-[--color-muted-foreground]',
  PUBLISHED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  ARCHIVED: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  SCHEDULED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
};

interface StatusBadgeProps {
  status: EntryStatus;
}

export function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
  const t = useTranslations('content.status');
  return <Badge className={STATUS_CLASS[status]}>{t(status)}</Badge>;
}

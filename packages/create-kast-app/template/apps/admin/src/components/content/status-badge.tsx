'use client';

import { Badge } from '@/components/ui/badge';
import type { EntryStatus } from '@kast-cms/sdk';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';

/**
 * Editorial state, mapped onto the shared status palette:
 * draft is inert, published is the goal state, scheduled is pending
 * information, archived is a soft caution.
 */
const STATUS_VARIANT: Record<EntryStatus, 'muted' | 'success' | 'info' | 'warning'> = {
  DRAFT: 'muted',
  PUBLISHED: 'success',
  SCHEDULED: 'info',
  ARCHIVED: 'warning',
};

interface StatusBadgeProps {
  status: EntryStatus;
}

export function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
  const t = useTranslations('content.status');
  return (
    <Badge variant={STATUS_VARIANT[status]} dot>
      {t(status)}
    </Badge>
  );
}

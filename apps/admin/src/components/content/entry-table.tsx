'use client';

import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ContentEntrySummary } from '@kast/sdk';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { JSX } from 'react';

interface EntryTableProps {
  typeId: string;
  entries: ContentEntrySummary[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  PUBLISHED: 'default',
  DRAFT: 'secondary',
  ARCHIVED: 'destructive',
};

export function EntryTable({
  typeId,
  entries,
  selected,
  onToggle,
  onToggleAll,
}: EntryTableProps): JSX.Element {
  const t = useTranslations('content');
  const ids = entries.map((e) => e.id);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              checked={allSelected}
              onCheckedChange={() => {
                onToggleAll(ids);
              }}
              aria-label="Select all"
            />
          </TableHead>
          <TableHead>{t('table.title')}</TableHead>
          <TableHead>{t('table.status')}</TableHead>
          <TableHead>{t('table.locale')}</TableHead>
          <TableHead>{t('table.author')}</TableHead>
          <TableHead>{t('table.updated')}</TableHead>
          <TableHead className="w-10">{t('table.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id} data-selected={selected.has(entry.id) ? 'true' : undefined}>
            <TableCell>
              <Checkbox
                checked={selected.has(entry.id)}
                onCheckedChange={() => {
                  onToggle(entry.id);
                }}
                aria-label={`Select entry ${entry.id}`}
              />
            </TableCell>
            <TableCell>
              <Link href={`/content/${typeId}/${entry.id}`} className="font-medium hover:underline">
                {entry.titleField ?? entry.id}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[entry.status]}>{t(`status.${entry.status}`)}</Badge>
            </TableCell>
            <TableCell>{entry.locale || '—'}</TableCell>
            <TableCell>{entry.authorName ?? '—'}</TableCell>
            <TableCell>{new Date(entry.updatedAt).toLocaleDateString()}</TableCell>
            <TableCell>
              <Link
                href={`/content/${typeId}/${entry.id}`}
                className="text-sm text-[--color-muted-foreground] hover:text-[--color-foreground]"
              >
                Edit
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ContentEntrySummary } from '@kast-cms/sdk';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { JSX } from 'react';
import { StatusBadge } from './status-badge';

interface EntryTableProps {
  typeId: string;
  entries: ContentEntrySummary[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
}

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
  const someSelected = !allSelected && ids.some((id) => selected.has(id));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <Checkbox
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
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
          <TableHead className="w-0 text-end">{t('table.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow
            key={entry.id}
            data-state={selected.has(entry.id) ? 'selected' : undefined}
            className="group"
          >
            <TableCell>
              <Checkbox
                checked={selected.has(entry.id)}
                onCheckedChange={() => {
                  onToggle(entry.id);
                }}
                aria-label={`Select entry ${entry.id}`}
              />
            </TableCell>
            <TableCell className="max-w-xs">
              <Link
                href={`/content/${typeId}/${entry.id}`}
                className="block truncate font-medium text-foreground transition-colors duration-150 ease-out-quad hover:text-primary"
              >
                {entry.titleField ?? entry.id}
              </Link>
            </TableCell>
            <TableCell>
              <StatusBadge status={entry.status} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {entry.locale ? (
                <span className="font-mono text-xs uppercase">{entry.locale}</span>
              ) : (
                '—'
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">{entry.authorName ?? '—'}</TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              {new Date(entry.updatedAt).toLocaleDateString()}
            </TableCell>
            <TableCell className="text-end">
              <Button
                asChild
                variant="ghost"
                size="xs"
                className="text-muted-foreground hover:text-foreground"
              >
                <Link href={`/content/${typeId}/${entry.id}`}>Edit</Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

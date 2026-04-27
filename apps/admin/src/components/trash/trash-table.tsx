'use client';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { TrashedItem, TrashModel } from '@kast/sdk';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';

interface Props {
  model: TrashModel;
  items: TrashedItem[];
  loading: boolean;
  actionId: string | null;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function TrashTable({ items, loading, actionId, onRestore, onDelete }: Props): JSX.Element {
  const t = useTranslations('trash');

  if (loading) {
    return (
      <p className="py-10 text-center text-sm text-[--color-muted-foreground]">{t('loading')}</p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[--color-border] p-12 text-center">
        <p className="text-sm text-[--color-muted-foreground]">{t('empty')}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('columns.name')}</TableHead>
          <TableHead>{t('columns.trashedAt')}</TableHead>
          <TableHead>{t('columns.daysUntilDeletion')}</TableHead>
          <TableHead className="text-right">{t('columns.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">{item.name}</TableCell>
            <TableCell>{formatDate(item.trashedAt)}</TableCell>
            <TableCell>
              <span className={item.daysUntilDeletion <= 3 ? 'text-red-500 font-medium' : ''}>
                {t('days', { count: item.daysUntilDeletion })}
              </span>
            </TableCell>
            <TableCell className="text-right space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled={actionId !== null}
                onClick={() => {
                  onRestore(item.id);
                }}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                {t('restore')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={actionId !== null}
                className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                onClick={() => {
                  onDelete(item.id);
                }}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                {t('delete')}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

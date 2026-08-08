'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { TrashedItem, TrashModel } from '@kast-cms/sdk';
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

/** Placeholder rows so the tab does not collapse while a model loads. */
function TrashTableSkeleton(): JSX.Element {
  return (
    <>
      {Array.from({ length: 4 }, (_, i) => (
        <TableRow key={i} className="hover:bg-transparent">
          <TableCell>
            <Skeleton className="h-3.5 w-48" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4.5 w-20 rounded-md" />
          </TableCell>
          <TableCell>
            <div className="flex justify-end gap-2">
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-8 w-28 rounded-md" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function TrashTable({ items, loading, actionId, onRestore, onDelete }: Props): JSX.Element {
  const t = useTranslations('trash');

  const isEmpty = items.length === 0;

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('columns.name')}</TableHead>
            <TableHead>{t('columns.trashedAt')}</TableHead>
            <TableHead>{t('columns.daysUntilDeletion')}</TableHead>
            <TableHead className="text-end">
              <span className="sr-only">{t('columns.actions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isEmpty && loading && <TrashTableSkeleton />}
          {isEmpty && !loading && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4} className="p-0">
                <EmptyState
                  Icon={Trash2}
                  size="sm"
                  title={t('empty')}
                  className="rounded-none border-0"
                />
              </TableCell>
            </TableRow>
          )}
          {items.map((item) => {
            // Three days out, the item is about to be gone for good — that is
            // the point at which the countdown earns a warning tone.
            const expiringSoon = item.daysUntilDeletion <= 3;
            return (
              <TableRow key={item.id}>
                <TableCell className="font-medium text-foreground">{item.name}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(item.trashedAt)}
                </TableCell>
                <TableCell>
                  <Badge variant={expiringSoon ? 'warning' : 'muted'} dot={expiringSoon}>
                    {t('days', { count: item.daysUntilDeletion })}
                  </Badge>
                </TableCell>
                <TableCell className="text-end">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionId !== null}
                      onClick={() => {
                        onRestore(item.id);
                      }}
                    >
                      <RotateCcw />
                      {t('restore')}
                    </Button>
                    <Button
                      variant="ghost-destructive"
                      size="sm"
                      disabled={actionId !== null}
                      onClick={() => {
                        onDelete(item.id);
                      }}
                    >
                      <Trash2 />
                      {t('delete')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

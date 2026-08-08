'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Hint } from '@/components/ui/tooltip';
import type { FormSubmissionSummary } from '@kast-cms/sdk';
import { ChevronLeft, ChevronRight, Eye, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React, { type JSX } from 'react';

type SubmissionsT = ReturnType<typeof useTranslations<'forms.submissions'>>;

interface SubmissionsPaginationProps {
  page: number;
  totalPages: number;
  t: SubmissionsT;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}

export function SubmissionsPagination({
  page,
  totalPages,
  t,
  setPage,
}: SubmissionsPaginationProps): JSX.Element | null {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={page <= 1}
        onClick={() => {
          setPage((p) => p - 1);
        }}
      >
        <ChevronLeft className="rtl:rotate-180" />
        {t('prev')}
      </Button>
      <span className="px-1 text-sm tabular-nums text-muted-foreground">
        <span className="font-medium text-foreground">{page}</span> / {totalPages}
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={page >= totalPages}
        onClick={() => {
          setPage((p) => p + 1);
        }}
      >
        {t('next')}
        <ChevronRight className="rtl:rotate-180" />
      </Button>
    </div>
  );
}

interface SubmissionsTableProps {
  submissions: FormSubmissionSummary[];
  dataKeys: string[];
  deleting: string | null;
  t: SubmissionsT;
  onView: (sub: FormSubmissionSummary) => void;
  onDelete: (subId: string) => void;
}

export function SubmissionsTable({
  submissions,
  dataKeys,
  deleting,
  t,
  onView,
  onDelete,
}: SubmissionsTableProps): JSX.Element {
  const tc = useTranslations('common');

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table.date')}</TableHead>
            {dataKeys.map((k) => (
              <TableHead key={k}>{k}</TableHead>
            ))}
            <TableHead className="w-24 text-end">
              <span className="sr-only">{t('table.actions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((sub) => (
            <TableRow key={sub.id} className="group">
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {new Date(sub.createdAt).toLocaleString()}
              </TableCell>
              {dataKeys.map((k) => (
                <TableCell key={k} className="max-w-xs truncate text-sm text-foreground">
                  {String(sub.data[k] ?? '')}
                </TableCell>
              ))}
              <TableCell className="text-end">
                <div className="flex items-center justify-end gap-1">
                  <Hint label={t('view')}>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t('view')}
                      onClick={() => {
                        onView(sub);
                      }}
                    >
                      <Eye />
                    </Button>
                  </Hint>
                  <Hint label={tc('delete')}>
                    <Button
                      size="icon-sm"
                      variant="ghost-destructive"
                      aria-label={tc('delete')}
                      loading={deleting === sub.id}
                      onClick={() => {
                        onDelete(sub.id);
                      }}
                    >
                      {deleting === sub.id ? null : <Trash2 />}
                    </Button>
                  </Hint>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

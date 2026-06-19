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
import type { FormSubmissionSummary } from '@kast-cms/sdk';
import { Eye, Trash2 } from 'lucide-react';
import { type useTranslations } from 'next-intl';
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
        {t('prev')}
      </Button>
      <span className="text-sm text-muted-foreground">
        {page} / {totalPages}
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
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table.date')}</TableHead>
            {dataKeys.map((k) => (
              <TableHead key={k}>{k}</TableHead>
            ))}
            <TableHead className="text-right">{t('table.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((sub) => (
            <TableRow key={sub.id}>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(sub.createdAt).toLocaleString()}
              </TableCell>
              {dataKeys.map((k) => (
                <TableCell key={k} className="max-w-xs truncate text-sm">
                  {String(sub.data[k] ?? '')}
                </TableCell>
              ))}
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t('view')}
                    onClick={() => {
                      onView(sub);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={deleting === sub.id}
                    onClick={() => {
                      onDelete(sub.id);
                    }}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

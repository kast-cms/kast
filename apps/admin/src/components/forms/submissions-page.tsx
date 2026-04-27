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
import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { FormSubmissionSummary } from '@kast-cms/sdk';
import { ArrowLeft, Download, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useState, type JSX } from 'react';

interface SubmissionsPaginationProps {
  page: number;
  totalPages: number;
  t: ReturnType<typeof useTranslations<'forms.submissions'>>;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}

function SubmissionsPagination({
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

interface SubmissionsPageClientProps {
  formId: string;
  formName: string;
}

export function SubmissionsPageClient({
  formId,
  formName,
}: SubmissionsPageClientProps): JSX.Element {
  const t = useTranslations('forms.submissions');
  const { session } = useSession();
  const router = useRouter();
  const [submissions, setSubmissions] = useState<FormSubmissionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const limit = 20;

  const load = useCallback(async (): Promise<void> => {
    if (!session) return;
    setLoading(true);
    try {
      const client = createApiClient(session.accessToken);
      const res = await client.forms.listSubmissions(formId, { page, limit });
      setSubmissions(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [session, formId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = useCallback(
    async (subId: string): Promise<void> => {
      if (!session) return;
      if (!window.confirm(t('deleteConfirm'))) return;
      setDeleting(subId);
      try {
        const client = createApiClient(session.accessToken);
        await client.forms.deleteSubmission(formId, subId);
        await load();
      } finally {
        setDeleting(null);
      }
    },
    [session, formId, load, t],
  );

  const firstSub = submissions[0];
  const dataKeys = firstSub !== undefined ? Object.keys(firstSub.data) : [];

  if (loading && submissions.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        {t('loading')}
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              router.push('/forms');
            }}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t('back')}
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{formName}</h2>
            <p className="text-sm text-muted-foreground">{t('subtitle', { total })}</p>
          </div>
        </div>
        <a
          href={`/api/v1/forms/${formId}/submissions/export`}
          download={`submissions-${formId}.csv`}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          <Download className="h-4 w-4" />
          {t('exportCsv')}
        </a>
      </div>

      {submissions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <>
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
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={deleting === sub.id}
                        onClick={() => {
                          void handleDelete(sub.id);
                        }}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <SubmissionsPagination page={page} totalPages={totalPages} t={t} setPage={setPage} />
        </>
      )}
    </div>
  );
}

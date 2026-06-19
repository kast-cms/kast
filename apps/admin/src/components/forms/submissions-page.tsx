'use client';

import { SubmissionDetailDialog } from '@/components/forms/submission-detail-dialog';
import { SubmissionsPagination, SubmissionsTable } from '@/components/forms/submissions-table';
import { Button } from '@/components/ui/button';
import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { FormSubmissionSummary } from '@kast-cms/sdk';
import { ArrowLeft, Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type JSX } from 'react';

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
  const [selected, setSelected] = useState<FormSubmissionSummary | null>(null);

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
        setSelected((prev) => (prev?.id === subId ? null : prev));
        await load();
      } finally {
        setDeleting(null);
      }
    },
    [session, formId, load, t],
  );

  if (loading && submissions.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        {t('loading')}
      </div>
    );
  }

  const firstSub = submissions[0];
  const dataKeys = firstSub !== undefined ? Object.keys(firstSub.data) : [];
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
            <ArrowLeft className="me-1 h-4 w-4" />
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
          <SubmissionsTable
            submissions={submissions}
            dataKeys={dataKeys}
            deleting={deleting}
            t={t}
            onView={setSelected}
            onDelete={(subId) => {
              void handleDelete(subId);
            }}
          />
          <SubmissionsPagination page={page} totalPages={totalPages} t={t} setPage={setPage} />
        </>
      )}

      <SubmissionDetailDialog
        submission={selected}
        t={t}
        onClose={() => {
          setSelected(null);
        }}
        onDelete={(subId) => {
          void handleDelete(subId);
        }}
      />
    </div>
  );
}

'use client';

import { SubmissionDetailDialog } from '@/components/forms/submission-detail-dialog';
import { SubmissionsPagination, SubmissionsTable } from '@/components/forms/submissions-table';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { FormSubmissionSummary } from '@kast-cms/sdk';
import { ArrowLeft, Download, Inbox } from 'lucide-react';
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

  // The count is meaningless until the first page lands, so it is held back
  // rather than flashing "0 submissions" at every visitor.
  const isFirstLoad = loading && submissions.length === 0;

  const header = (
    <PageHeader
      title={formName}
      description={isFirstLoad ? undefined : t('subtitle', { total })}
      breadcrumb={
        <Button
          size="sm"
          variant="ghost"
          className="-ms-2 self-start text-muted-foreground hover:text-foreground"
          onClick={() => {
            router.push('/forms');
          }}
        >
          <ArrowLeft className="rtl:rotate-180" />
          {t('back')}
        </Button>
      }
      actions={
        <Button variant="outline" asChild>
          <a
            href={`/api/v1/forms/${formId}/submissions/export`}
            download={`submissions-${formId}.csv`}
          >
            <Download />
            {t('exportCsv')}
          </a>
        </Button>
      }
    />
  );

  if (isFirstLoad) {
    return (
      <div className="space-y-6" aria-busy="true">
        {header}
        <p role="status" className="sr-only">
          {t('loading')}
        </p>
        <div className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-xs">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const firstSub = submissions[0];
  const dataKeys = firstSub !== undefined ? Object.keys(firstSub.data) : [];
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {header}

      {submissions.length === 0 ? (
        <EmptyState Icon={Inbox} title={t('empty')} />
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

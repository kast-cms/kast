'use client';

import { SubmissionDetailDialog } from '@/components/forms/submission-detail-dialog';
import { SubmissionsPagination, SubmissionsTable } from '@/components/forms/submissions-table';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiClient, useSession } from '@/lib/session';
import type { FormSubmissionSummary } from '@kast-cms/sdk';
import { ArrowLeft, Download, Inbox } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type JSX } from 'react';

interface SubmissionsPageClientProps {
  formId: string;
  formName: string;
}

interface SubmissionsHeaderProps {
  formName: string;
  total: number;
  isFirstLoad: boolean;
  onBack: () => void;
  onExport: () => void;
}

function SubmissionsHeader({
  formName,
  total,
  isFirstLoad,
  onBack,
  onExport,
}: SubmissionsHeaderProps): JSX.Element {
  const t = useTranslations('forms.submissions');
  return (
    <PageHeader
      title={formName}
      description={isFirstLoad ? undefined : t('subtitle', { total })}
      breadcrumb={
        <Button
          size="sm"
          variant="ghost"
          className="-ms-2 self-start text-muted-foreground hover:text-foreground"
          onClick={onBack}
        >
          <ArrowLeft className="rtl:rotate-180" />
          {t('back')}
        </Button>
      }
      actions={
        <Button variant="outline" onClick={onExport}>
          <Download />
          {t('exportCsv')}
        </Button>
      }
    />
  );
}

export function SubmissionsPageClient({
  formId,
  formName,
}: SubmissionsPageClientProps): JSX.Element {
  const client = useApiClient();
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
      const res = await client.forms.listSubmissions(formId, { page, limit });
      setSubmissions(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [session, formId, page, client]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = useCallback(
    async (subId: string): Promise<void> => {
      if (!session) return;
      if (!window.confirm(t('deleteConfirm'))) return;
      setDeleting(subId);
      try {
        await client.forms.deleteSubmission(formId, subId);
        setSelected((prev) => (prev?.id === subId ? null : prev));
        await load();
      } finally {
        setDeleting(null);
      }
    },
    [session, formId, load, t, client],
  );

  /** Writes the new read state locally rather than refetching the whole page. */
  const applyRead = useCallback((subId: string, isRead: boolean): void => {
    const stamp = isRead ? new Date().toISOString() : null;
    setSubmissions((prev) =>
      prev.map((s) => (s.id === subId ? { ...s, isRead, readAt: stamp } : s)),
    );
    setSelected((prev) => (prev?.id === subId ? { ...prev, isRead, readAt: stamp } : prev));
  }, []);

  const toggleRead = useCallback(
    async (sub: FormSubmissionSummary): Promise<void> => {
      const next = !sub.isRead;
      applyRead(sub.id, next);
      try {
        await client.forms.markSubmissionRead(formId, sub.id, next);
      } catch {
        applyRead(sub.id, sub.isRead); // put it back; the server said no
      }
    },
    [applyRead, client, formId],
  );

  /** Opening a submission is what "reading" it means. */
  const handleView = useCallback(
    (sub: FormSubmissionSummary): void => {
      setSelected(sub);
      if (!sub.isRead) void toggleRead(sub);
    },
    [toggleRead],
  );

  /**
   * The export route requires a bearer token, so it cannot be a plain <a href>:
   * the browser would send no Authorization header and get a 401. Fetch it
   * through the SDK and hand the blob to a temporary object URL instead.
   */
  const downloadCsv = useCallback(async (): Promise<void> => {
    const blob = await client.forms.exportCsv(formId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `submissions-${formId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [client, formId]);

  // The count is meaningless until the first page lands, so it is held back
  // rather than flashing "0 submissions" at every visitor.
  const isFirstLoad = loading && submissions.length === 0;

  const header = (
    <SubmissionsHeader
      formName={formName}
      total={total}
      isFirstLoad={isFirstLoad}
      onBack={() => {
        router.push('/forms');
      }}
      onExport={() => {
        void downloadCsv();
      }}
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
            onView={handleView}
            onToggleRead={(sub) => {
              void toggleRead(sub);
            }}
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

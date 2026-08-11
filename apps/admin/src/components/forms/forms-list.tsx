'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Hint } from '@/components/ui/tooltip';
import { useApiClient, useSession } from '@/lib/session';
import type { FormSummary } from '@kast-cms/sdk';
import { FileText, Inbox, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type JSX } from 'react';

/** Live/paused is a real state change for a public endpoint, so it reads as status. */
function StatusBadge({ isActive }: { isActive: boolean }): JSX.Element {
  const t = useTranslations('forms.status');
  return (
    <Badge variant={isActive ? 'success' : 'muted'} dot>
      {isActive ? t('active') : t('inactive')}
    </Badge>
  );
}

/** Placeholder rows so the table keeps its shape during the first load. */
function FormsTableSkeleton(): JSX.Element {
  return (
    <>
      {Array.from({ length: 4 }, (_, i) => (
        <TableRow key={i} className="hover:bg-transparent">
          <TableCell>
            <Skeleton className="h-3.5 w-40" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4.5 w-28 rounded-sm" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-8" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4.5 w-20 rounded-md" />
          </TableCell>
          <TableCell>
            <Skeleton className="ms-auto h-8 w-48 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

interface FormsEmptyRowProps {
  onCreate: () => void;
}

/** The empty state lives inside the table body so the header stays put. */
function FormsEmptyRow({ onCreate }: FormsEmptyRowProps): JSX.Element {
  const t = useTranslations('forms');
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={5} className="p-0">
        <EmptyState
          Icon={FileText}
          size="sm"
          title={t('empty')}
          description={t('description')}
          className="rounded-none border-0"
          action={
            <Button variant="outline" size="sm" onClick={onCreate}>
              <Plus />
              {t('actions.createFirst')}
            </Button>
          }
        />
      </TableCell>
    </TableRow>
  );
}

interface FormRowActionsProps {
  deleting: boolean;
  onViewSubmissions: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** Trailing action group for one row: submissions, edit, delete. */
function FormRowActions({
  deleting,
  onViewSubmissions,
  onEdit,
  onDelete,
}: FormRowActionsProps): JSX.Element {
  const t = useTranslations('forms');
  const tc = useTranslations('common');
  return (
    <div className="flex items-center justify-end gap-1">
      <Button size="sm" variant="ghost" onClick={onViewSubmissions}>
        <Inbox />
        {t('actions.viewSubmissions')}
      </Button>
      <Button size="sm" variant="outline" onClick={onEdit}>
        <Pencil />
        {t('actions.edit')}
      </Button>
      <Hint label={tc('delete')}>
        <Button
          size="icon-sm"
          variant="ghost-destructive"
          aria-label={tc('delete')}
          loading={deleting}
          onClick={onDelete}
        >
          {deleting ? null : <Trash2 />}
        </Button>
      </Hint>
    </div>
  );
}

interface FormRowProps {
  form: FormSummary;
  deleting: boolean;
  onViewSubmissions: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** One form in the listing. */
function FormRow({
  form,
  deleting,
  onViewSubmissions,
  onEdit,
  onDelete,
}: FormRowProps): JSX.Element {
  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">{form.name}</TableCell>
      <TableCell>
        <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
          {form.slug}
        </code>
      </TableCell>
      {/* The list endpoint returns `_count.submissions` only — there is no field
          count in FormSummary, so the old "Fields" column was rendering the
          submissions figure a second time under the wrong heading. Column
          dropped rather than left showing a number that means something else. */}
      <TableCell className="text-end text-muted-foreground">{form._count.submissions}</TableCell>
      <TableCell>
        <StatusBadge isActive={form.isActive} />
      </TableCell>
      <TableCell className="text-end">
        <FormRowActions
          deleting={deleting}
          onViewSubmissions={onViewSubmissions}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </TableCell>
    </TableRow>
  );
}

export function FormsListClient(): JSX.Element {
  const client = useApiClient();
  const t = useTranslations('forms');
  const { session } = useSession();
  const router = useRouter();
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!session) return;
    setLoading(true);
    try {
      const data = await client.forms.list();
      setForms(data);
    } finally {
      setLoading(false);
    }
  }, [session, client]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = useCallback(
    async (form: FormSummary): Promise<void> => {
      if (!session) return;
      if (!window.confirm(t('deleteConfirm', { name: form.name }))) return;
      setDeleting(form.id);
      try {
        await client.forms.delete(form.id);
        await load();
      } finally {
        setDeleting(null);
      }
    },
    [session, load, t, client],
  );

  const isEmpty = forms.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Button
            onClick={() => {
              router.push('/forms/new');
            }}
          >
            <Plus />
            {t('actions.create')}
          </Button>
        }
      />

      {loading && (
        <p role="status" className="sr-only">
          {t('loading')}
        </p>
      )}

      <Card className="overflow-hidden" aria-busy={loading || undefined}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('table.name')}</TableHead>
              <TableHead>{t('table.slug')}</TableHead>
              <TableHead className="text-end">{t('table.submissions')}</TableHead>
              <TableHead>{t('table.status')}</TableHead>
              <TableHead className="text-end">
                <span className="sr-only">{t('table.actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <FormsTableSkeleton />}

            {!loading && isEmpty && (
              <FormsEmptyRow
                onCreate={() => {
                  router.push('/forms/new');
                }}
              />
            )}

            {!loading &&
              forms.map((form) => (
                <FormRow
                  key={form.id}
                  form={form}
                  deleting={deleting === form.id}
                  onViewSubmissions={() => {
                    router.push(`/forms/${form.id}/submissions`);
                  }}
                  onEdit={() => {
                    router.push(`/forms/${form.id}/edit`);
                  }}
                  onDelete={() => {
                    void handleDelete(form);
                  }}
                />
              ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

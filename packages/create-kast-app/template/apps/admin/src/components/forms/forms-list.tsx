'use client';

import { Badge } from '@/components/ui/badge';
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
import type { FormSummary } from '@kast-cms/sdk';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type JSX } from 'react';

function StatusBadge({ isActive }: { isActive: boolean }): JSX.Element {
  const t = useTranslations('forms.status');
  return (
    <Badge
      variant={isActive ? 'default' : 'outline'}
      className={isActive ? '' : 'border-muted-foreground text-muted-foreground'}
    >
      {isActive ? t('active') : t('inactive')}
    </Badge>
  );
}

export function FormsListClient(): JSX.Element {
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
      const client = createApiClient(session.accessToken);
      const data = await client.forms.list();
      setForms(data);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = useCallback(
    async (form: FormSummary): Promise<void> => {
      if (!session) return;
      if (!window.confirm(t('deleteConfirm', { name: form.name }))) return;
      setDeleting(form.id);
      try {
        const client = createApiClient(session.accessToken);
        await client.forms.delete(form.id);
        await load();
      } finally {
        setDeleting(null);
      }
    },
    [session, load, t],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        {t('loading')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Button
          onClick={() => {
            router.push('/forms/new');
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('actions.create')}
        </Button>
      </div>

      {forms.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => {
              router.push('/forms/new');
            }}
          >
            {t('actions.createFirst')}
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.name')}</TableHead>
                <TableHead>{t('table.slug')}</TableHead>
                <TableHead>{t('table.fields')}</TableHead>
                <TableHead>{t('table.submissions')}</TableHead>
                <TableHead>{t('table.status')}</TableHead>
                <TableHead className="text-right">{t('table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forms.map((form) => (
                <TableRow key={form.id}>
                  <TableCell className="font-medium">{form.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {form.slug}
                  </TableCell>
                  <TableCell>{form._count.submissions}</TableCell>
                  <TableCell>{form._count.submissions}</TableCell>
                  <TableCell>
                    <StatusBadge isActive={form.isActive} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          router.push(`/forms/${form.id}/submissions`);
                        }}
                      >
                        {t('actions.viewSubmissions')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          router.push(`/forms/${form.id}/edit`);
                        }}
                      >
                        {t('actions.edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={deleting === form.id}
                        onClick={() => {
                          void handleDelete(form);
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
      )}
    </div>
  );
}

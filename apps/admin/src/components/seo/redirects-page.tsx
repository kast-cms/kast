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
import type { CreateRedirectBody } from '@kast/sdk';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';
import { CreateRedirectDialog } from './create-redirect-dialog';
import { useSeo } from './use-seo';

export function RedirectsPage(): JSX.Element {
  const t = useTranslations('seo.redirects');
  const tTypes = useTranslations('seo.redirects.type');
  const { redirects, redirectsLoading, createRedirect, deleteRedirect } = useSeo();
  const [dialogOpen, setDialogOpen] = useState(false);

  async function handleCreate(body: CreateRedirectBody): Promise<void> {
    await createRedirect(body);
  }

  function handleDelete(id: string): void {
    void deleteRedirect(id);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <Button onClick={(): void => setDialogOpen(true)}>{t('createButton')}</Button>
      </div>

      {redirectsLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : redirects.length === 0 ? (
        <div className="rounded border border-dashed p-8 text-center">
          <p className="font-medium">{t('emptyTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('emptyDescription')}</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('table.from')}</TableHead>
              <TableHead>{t('table.to')}</TableHead>
              <TableHead>{t('table.type')}</TableHead>
              <TableHead>{t('table.hits')}</TableHead>
              <TableHead>{t('table.active')}</TableHead>
              <TableHead>{t('table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {redirects.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-sm">{r.fromPath}</TableCell>
                <TableCell className="font-mono text-sm">{r.toPath}</TableCell>
                <TableCell>{tTypes(r.type)}</TableCell>
                <TableCell>{r.hitCount}</TableCell>
                <TableCell>{r.isActive ? 'Yes' : 'No'}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={(): void => handleDelete(r.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CreateRedirectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={handleCreate}
      />
    </div>
  );
}

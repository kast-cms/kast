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
import { useToast } from '@/components/ui/use-toast';
import type { CreateRedirectBody } from '@kast-cms/sdk';
import { Download, Trash2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState, type ChangeEvent, type JSX } from 'react';
import { CreateRedirectDialog } from './create-redirect-dialog';
import { useSeo } from './use-seo';

export function RedirectsPage(): JSX.Element {
  const t = useTranslations('seo.redirects');
  const tTypes = useTranslations('seo.redirects.type');
  const {
    redirects,
    redirectsLoading,
    createRedirect,
    deleteRedirect,
    importRedirects,
    exportRedirects,
  } = useSeo();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleCreate(body: CreateRedirectBody): Promise<void> {
    await createRedirect(body);
  }

  function handleDelete(id: string): void {
    void deleteRedirect(id);
  }

  function handleImportClick(): void {
    fileInputRef.current?.click();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    // Reset so selecting the same file again re-triggers change.
    event.target.value = '';
    if (!file) return;
    void (async (): Promise<void> => {
      setImporting(true);
      try {
        const result = await importRedirects(file);
        toast({
          variant: 'success',
          title: t('importSuccessTitle'),
          description: t('importSuccessDescription', {
            created: result.created,
            skipped: result.skipped,
            errors: result.errors,
          }),
        });
      } catch (err) {
        toast({
          variant: 'destructive',
          title: t('importErrorTitle'),
          description: err instanceof Error ? err.message : t('genericError'),
        });
      } finally {
        setImporting(false);
      }
    })();
  }

  function handleExport(): void {
    void (async (): Promise<void> => {
      setExporting(true);
      try {
        const blob = await exportRedirects();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'redirects.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        toast({
          variant: 'destructive',
          title: t('exportErrorTitle'),
          description: err instanceof Error ? err.message : t('genericError'),
        });
      } finally {
        setExporting(false);
      }
    })();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button variant="outline" onClick={handleImportClick} disabled={importing}>
            <Upload className="me-2 size-4" />
            {importing ? t('importing') : t('importButton')}
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="me-2 size-4" />
            {exporting ? t('exporting') : t('exportButton')}
          </Button>
          <Button onClick={(): void => setDialogOpen(true)}>{t('createButton')}</Button>
        </div>
      </div>

      {redirectsLoading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
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
                <TableCell>{r.isActive ? t('yes') : t('no')}</TableCell>
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

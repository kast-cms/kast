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
import type { CreateRedirectBody, Redirect, RedirectType } from '@kast-cms/sdk';
import { Download, Plus, Signpost, Trash2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ChangeEvent, type JSX, type RefObject } from 'react';
import { CreateRedirectDialog } from './create-redirect-dialog';
import { useRedirectCsv } from './use-redirect-csv';
import { useSeo } from './use-seo';

/** A 301 is the settled state; a 302 is temporary, so it reads as in-flight. */
const TYPE_VARIANT: Record<RedirectType, 'secondary' | 'info'> = {
  PERMANENT: 'secondary',
  TEMPORARY: 'info',
};

interface RedirectsToolbarProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  importing: boolean;
  exporting: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onImportClick: () => void;
  onExport: () => void;
  onCreate: () => void;
}

/** Header actions: the hidden CSV file input plus import, export and create. */
function RedirectsToolbar({
  fileInputRef,
  importing,
  exporting,
  onFileChange,
  onImportClick,
  onExport,
  onCreate,
}: RedirectsToolbarProps): JSX.Element {
  const t = useTranslations('seo.redirects');

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={onFileChange}
      />
      <Button variant="outline" onClick={onImportClick} loading={importing}>
        {!importing && <Upload />}
        {importing ? t('importing') : t('importButton')}
      </Button>
      <Button variant="outline" onClick={onExport} loading={exporting}>
        {!exporting && <Download />}
        {exporting ? t('exporting') : t('exportButton')}
      </Button>
      <Button onClick={onCreate}>
        <Plus />
        {t('createButton')}
      </Button>
    </>
  );
}

/** Column titles for the redirects table. */
function RedirectsTableHead(): JSX.Element {
  const t = useTranslations('seo.redirects');
  const tCommon = useTranslations('common');

  return (
    <TableHeader>
      <TableRow>
        <TableHead>{t('table.from')}</TableHead>
        <TableHead>{t('table.to')}</TableHead>
        <TableHead>{t('table.type')}</TableHead>
        <TableHead className="text-end">{t('table.hits')}</TableHead>
        <TableHead>{t('table.active')}</TableHead>
        <TableHead className="w-0">
          <span className="sr-only">{tCommon('delete')}</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

/** Placeholder rows so the table keeps its shape while the first load runs. */
function RedirectsTableSkeleton(): JSX.Element {
  return (
    <>
      {Array.from({ length: 4 }, (_, i) => (
        <TableRow key={i} className="hover:bg-transparent">
          <TableCell>
            <Skeleton className="h-3.5 w-40" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-40" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4.5 w-24 rounded-md" />
          </TableCell>
          <TableCell className="text-end">
            <Skeleton className="ms-auto h-3.5 w-8" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4.5 w-16 rounded-md" />
          </TableCell>
          <TableCell>
            <Skeleton className="ms-auto size-8 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

interface RedirectsEmptyRowProps {
  onCreate: () => void;
}

/** Table-wide empty state, shown once loading settles with nothing to list. */
function RedirectsEmptyRow({ onCreate }: RedirectsEmptyRowProps): JSX.Element {
  const t = useTranslations('seo.redirects');

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={6} className="p-0">
        <EmptyState
          Icon={Signpost}
          size="sm"
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          className="rounded-none border-0"
          action={
            <Button variant="outline" size="sm" onClick={onCreate}>
              <Plus />
              {t('createButton')}
            </Button>
          }
        />
      </TableCell>
    </TableRow>
  );
}

interface RedirectRowProps {
  redirect: Redirect;
  onDelete: (id: string) => void;
}

/** One redirect: both paths, its type, hit count, active flag and delete action. */
function RedirectRow({ redirect, onDelete }: RedirectRowProps): JSX.Element {
  const t = useTranslations('seo.redirects');
  const tTypes = useTranslations('seo.redirects.type');
  const tCommon = useTranslations('common');

  return (
    <TableRow>
      <TableCell className="font-mono text-xs text-foreground">{redirect.fromPath}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{redirect.toPath}</TableCell>
      <TableCell>
        <Badge variant={TYPE_VARIANT[redirect.type]}>{tTypes(redirect.type)}</Badge>
      </TableCell>
      <TableCell className="text-end text-muted-foreground">{redirect.hitCount}</TableCell>
      <TableCell>
        <Badge variant={redirect.isActive ? 'success' : 'muted'} dot>
          {redirect.isActive ? t('yes') : t('no')}
        </Badge>
      </TableCell>
      <TableCell className="text-end">
        <Hint label={tCommon('delete')}>
          <Button
            variant="ghost-destructive"
            size="icon-sm"
            aria-label={tCommon('delete')}
            onClick={(): void => onDelete(redirect.id)}
          >
            <Trash2 />
          </Button>
        </Hint>
      </TableCell>
    </TableRow>
  );
}

export function RedirectsPage(): JSX.Element {
  const t = useTranslations('seo.redirects');
  const {
    redirects,
    redirectsLoading,
    createRedirect,
    deleteRedirect,
    importRedirects,
    exportRedirects,
  } = useSeo();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { importing, exporting, fileInputRef, handleImportClick, handleFileChange, handleExport } =
    useRedirectCsv({ importRedirects, exportRedirects });

  async function handleCreate(body: CreateRedirectBody): Promise<void> {
    await createRedirect(body);
  }

  function handleDelete(id: string): void {
    void deleteRedirect(id);
  }

  function openDialog(): void {
    setDialogOpen(true);
  }

  const isEmpty = redirects.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <RedirectsToolbar
            fileInputRef={fileInputRef}
            importing={importing}
            exporting={exporting}
            onFileChange={handleFileChange}
            onImportClick={handleImportClick}
            onExport={handleExport}
            onCreate={openDialog}
          />
        }
      />

      <Card className="overflow-hidden">
        <Table>
          <RedirectsTableHead />
          <TableBody>
            {isEmpty && redirectsLoading && <RedirectsTableSkeleton />}
            {isEmpty && !redirectsLoading && <RedirectsEmptyRow onCreate={openDialog} />}
            {redirects.map((r) => (
              <RedirectRow key={r.id} redirect={r} onDelete={handleDelete} />
            ))}
          </TableBody>
        </Table>
      </Card>

      <CreateRedirectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={handleCreate}
      />
    </div>
  );
}

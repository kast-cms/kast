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
import type { LocaleSummary } from '@kast-cms/sdk';
import { Languages, Plus, Star, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';
import { CreateLocaleDialog } from './create-locale-dialog';
import { useLocales } from './use-locales';

function DirectionBadge({ direction }: { direction: string }): JSX.Element {
  return (
    <Badge variant="outline" size="sm" className="font-mono">
      {direction}
    </Badge>
  );
}

function LocaleActions({
  locale,
  onSetDefault,
  onDelete,
}: {
  locale: LocaleSummary;
  onSetDefault: (code: string) => void;
  onDelete: (code: string) => void;
}): JSX.Element {
  const t = useTranslations('locales');
  if (locale.isDefault) {
    return (
      <div className="flex items-center justify-end">
        <Badge variant="brand">
          <Star />
          {t('defaultBadge')}
        </Badge>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-end gap-1">
      <Hint label={t('setDefault')}>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={t('setDefault')}
          onClick={() => onSetDefault(locale.code)}
        >
          <Star />
        </Button>
      </Hint>
      <Hint label={t('delete')}>
        <Button
          size="icon-sm"
          variant="ghost-destructive"
          aria-label={t('delete')}
          onClick={() => onDelete(locale.code)}
        >
          <Trash2 />
        </Button>
      </Hint>
    </div>
  );
}

/** Placeholder rows so the table keeps its shape while the first load runs. */
function LocalesTableSkeleton(): JSX.Element {
  return (
    <>
      {Array.from({ length: 4 }, (_, i) => (
        <TableRow key={i} className="hover:bg-transparent">
          <TableCell>
            <Skeleton className="h-3.5 w-10" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-28" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4.5 w-12 rounded-sm" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4.5 w-16 rounded-md" />
          </TableCell>
          <TableCell>
            <Skeleton className="ms-auto h-8 w-20" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function LocalesPage(): JSX.Element {
  const t = useTranslations('locales');
  const { locales, loading, createLocale, deleteLocale, setDefaultLocale } = useLocales();
  const [showCreate, setShowCreate] = useState(false);

  const handleSetDefault = (code: string): void => {
    void setDefaultLocale(code);
  };

  const handleDelete = (code: string): void => {
    if (!window.confirm(t('deleteConfirm'))) return;
    void deleteLocale(code);
  };

  const isEmpty = locales.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus />
            {t('addLocale')}
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.code')}</TableHead>
              <TableHead>{t('columns.name')}</TableHead>
              <TableHead>{t('columns.nativeName')}</TableHead>
              <TableHead>{t('columns.direction')}</TableHead>
              <TableHead>{t('columns.active')}</TableHead>
              <TableHead className="w-40 text-end">
                <span className="sr-only">{t('columns.actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isEmpty && loading && <LocalesTableSkeleton />}
            {isEmpty && !loading && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    Icon={Languages}
                    size="sm"
                    title={t('empty')}
                    className="rounded-none border-0"
                    action={
                      <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
                        <Plus />
                        {t('addLocale')}
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            )}
            {locales.map((locale) => (
              <TableRow key={locale.code}>
                <TableCell className="font-mono text-xs font-medium">{locale.code}</TableCell>
                <TableCell className="font-medium text-foreground">{locale.name}</TableCell>
                <TableCell className="text-muted-foreground">{locale.nativeName}</TableCell>
                <TableCell>
                  <DirectionBadge direction={locale.direction} />
                </TableCell>
                <TableCell>
                  <Badge variant={locale.isActive ? 'success' : 'muted'} dot>
                    {locale.isActive ? t('active') : t('inactive')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <LocaleActions
                    locale={locale}
                    onSetDefault={handleSetDefault}
                    onDelete={handleDelete}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <CreateLocaleDialog open={showCreate} onOpenChange={setShowCreate} onCreate={createLocale} />
    </div>
  );
}

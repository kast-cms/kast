'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { LocaleSummary } from '@kast-cms/sdk';
import { Languages, Plus, Star, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';
import { CreateLocaleDialog } from './create-locale-dialog';
import { useLocales } from './use-locales';

function DirectionBadge({ direction }: { direction: string }): JSX.Element {
  return <Badge variant={direction === 'RTL' ? 'warning' : 'secondary'}>{direction}</Badge>;
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
    return <Badge variant="success">{t('defaultBadge')}</Badge>;
  }
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onSetDefault(locale.code)}
        title={t('setDefault')}
      >
        <Star className="size-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onDelete(locale.code)}
        title={t('delete')}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Languages className="size-5" />
          <h1 className="text-xl font-semibold">{t('title')}</h1>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="me-2 size-4" />
          {t('addLocale')}
        </Button>
      </div>

      {loading && <Spinner />}

      {!loading && locales.length === 0 && <p className="text-muted-foreground">{t('empty')}</p>}

      {!loading && locales.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.code')}</TableHead>
              <TableHead>{t('columns.name')}</TableHead>
              <TableHead>{t('columns.nativeName')}</TableHead>
              <TableHead>{t('columns.direction')}</TableHead>
              <TableHead>{t('columns.active')}</TableHead>
              <TableHead>{t('columns.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locales.map((locale) => (
              <TableRow key={locale.code}>
                <TableCell className="font-mono">{locale.code}</TableCell>
                <TableCell>{locale.name}</TableCell>
                <TableCell>{locale.nativeName}</TableCell>
                <TableCell>
                  <DirectionBadge direction={locale.direction} />
                </TableCell>
                <TableCell>
                  <Badge variant={locale.isActive ? 'success' : 'secondary'}>
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
      )}

      <CreateLocaleDialog open={showCreate} onOpenChange={setShowCreate} onCreate={createLocale} />
    </div>
  );
}

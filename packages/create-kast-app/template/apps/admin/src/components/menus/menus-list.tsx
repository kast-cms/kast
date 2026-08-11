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
import type { MenuSummary } from '@kast-cms/sdk';
import { ListTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type JSX } from 'react';

/** Placeholder rows so the table keeps its shape during the first load. */
function MenusTableSkeleton(): JSX.Element {
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
            <Skeleton className="h-4.5 w-10 rounded-md" />
          </TableCell>
          <TableCell>
            <Skeleton className="ms-auto h-8 w-28 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function MenusListClient(): JSX.Element {
  const client = useApiClient();
  const t = useTranslations('menus');
  const tc = useTranslations('common');
  const { session } = useSession();
  const router = useRouter();
  const [menus, setMenus] = useState<MenuSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!session) return;
    setLoading(true);
    try {
      const data = await client.menus.list();
      setMenus(data);
    } finally {
      setLoading(false);
    }
  }, [session, client]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = useCallback(
    async (menu: MenuSummary): Promise<void> => {
      if (!session) return;
      if (!window.confirm(t('deleteConfirm', { name: menu.name }))) return;
      setDeleting(menu.id);
      try {
        await client.menus.delete(menu.id);
        await load();
      } finally {
        setDeleting(null);
      }
    },
    [session, load, t, client],
  );

  const isEmpty = menus.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          <Button
            onClick={() => {
              router.push('/menus/new');
            }}
          >
            <Plus />
            {t('new')}
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
              <TableHead>{t('table.items')}</TableHead>
              <TableHead className="w-32 text-end">
                <span className="sr-only">{t('table.actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <MenusTableSkeleton />}

            {!loading && isEmpty && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="p-0">
                  <EmptyState
                    Icon={ListTree}
                    size="sm"
                    title={t('empty')}
                    description={t('subtitle')}
                    className="rounded-none border-0"
                    action={
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          router.push('/menus/new');
                        }}
                      >
                        <Plus />
                        {t('new')}
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              menus.map((menu) => (
                <TableRow key={menu.id}>
                  <TableCell className="font-medium text-foreground">{menu.name}</TableCell>
                  <TableCell>
                    <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {menu.slug}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant={menu.itemCount > 0 ? 'muted' : 'outline'}>
                      {menu.itemCount}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          router.push(`/menus/${menu.id}`);
                        }}
                      >
                        <Pencil />
                        {t('edit')}
                      </Button>
                      <Hint label={tc('delete')}>
                        <Button
                          size="icon-sm"
                          variant="ghost-destructive"
                          aria-label={tc('delete')}
                          loading={deleting === menu.id}
                          onClick={() => {
                            void handleDelete(menu);
                          }}
                        >
                          {deleting === menu.id ? null : <Trash2 />}
                        </Button>
                      </Hint>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

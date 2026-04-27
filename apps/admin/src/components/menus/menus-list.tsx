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
import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { MenuSummary } from '@kast/sdk';
import { ListTree, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type JSX } from 'react';

export function MenusListClient(): JSX.Element {
  const t = useTranslations('menus');
  const { session } = useSession();
  const router = useRouter();
  const [menus, setMenus] = useState<MenuSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!session) return;
    setLoading(true);
    try {
      const client = createApiClient(session.accessToken);
      const data = await client.menus.list();
      setMenus(data);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = useCallback(
    async (menu: MenuSummary): Promise<void> => {
      if (!session) return;
      if (!window.confirm(t('deleteConfirm', { name: menu.name }))) return;
      setDeleting(menu.id);
      try {
        const client = createApiClient(session.accessToken);
        await client.menus.delete(menu.id);
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
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button
          onClick={() => {
            router.push('/menus/new');
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('new')}
        </Button>
      </div>
      {menus.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <ListTree className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.name')}</TableHead>
                <TableHead>{t('table.slug')}</TableHead>
                <TableHead>{t('table.items')}</TableHead>
                <TableHead className="w-[120px]">{t('table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {menus.map((menu) => (
                <TableRow key={menu.id}>
                  <TableCell className="font-medium">{menu.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {menu.slug}
                  </TableCell>
                  <TableCell>{menu.itemCount}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          router.push(`/menus/${menu.id}`);
                        }}
                      >
                        {t('edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={deleting === menu.id}
                        onClick={() => {
                          void handleDelete(menu);
                        }}
                        className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
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

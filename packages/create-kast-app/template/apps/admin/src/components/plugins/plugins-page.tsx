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
import type { PluginRecord } from '@kast-cms/sdk';
import { Puzzle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type JSX } from 'react';

function StatusBadge({ isActive }: { isActive: boolean }): JSX.Element {
  const t = useTranslations('plugins.status');
  return (
    <Badge
      variant={isActive ? 'default' : 'outline'}
      className={isActive ? '' : 'border-muted-foreground text-muted-foreground'}
    >
      {isActive ? t('enabled') : t('disabled')}
    </Badge>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function PluginsPageClient(): JSX.Element {
  const t = useTranslations('plugins');
  const { session } = useSession();
  const [plugins, setPlugins] = useState<PluginRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!session) return;
    setLoading(true);
    try {
      const client = createApiClient(session.accessToken);
      const res = await client.plugins.list();
      setPlugins(res.data);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(
    async (plugin: PluginRecord): Promise<void> => {
      if (!session) return;
      setBusy(plugin.name);
      try {
        const client = createApiClient(session.accessToken);
        const action = plugin.isActive ? client.plugins.disable : client.plugins.enable;
        await action.call(client.plugins, plugin.name);
        await load();
      } finally {
        setBusy(null);
      }
    },
    [session, load],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        {t('loading')}
      </div>
    );
  }

  if (plugins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
        <Puzzle className="h-10 w-10 opacity-40" />
        <p className="text-sm">{t('empty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table.name')}</TableHead>
            <TableHead>{t('table.version')}</TableHead>
            <TableHead>{t('table.description')}</TableHead>
            <TableHead>{t('table.status')}</TableHead>
            <TableHead>{t('table.installed')}</TableHead>
            <TableHead className="text-end">{t('table.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plugins.map((plugin) => (
            <TableRow key={plugin.id}>
              <TableCell className="font-medium">{plugin.displayName}</TableCell>
              <TableCell className="font-mono text-xs">{plugin.version}</TableCell>
              <TableCell className="text-muted-foreground">{plugin.description ?? '—'}</TableCell>
              <TableCell>
                <StatusBadge isActive={plugin.isActive} />
              </TableCell>
              <TableCell>{formatDate(plugin.installedAt)}</TableCell>
              <TableCell className="text-end">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy === plugin.name || plugin.isSystemPlugin}
                  onClick={() => void toggle(plugin)}
                >
                  {plugin.isActive ? t('actions.disable') : t('actions.enable')}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

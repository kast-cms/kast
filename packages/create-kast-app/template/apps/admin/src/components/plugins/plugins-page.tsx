'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiClient, useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import type { PluginRecord } from '@kast-cms/sdk';
import { Cloud, CreditCard, Mail, Puzzle, Search, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type ComponentType, type JSX } from 'react';

/** One icon per known plugin so the grid can be scanned by shape, not just by name. */
const PLUGIN_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  'kast-plugin-meilisearch': Search,
  'kast-plugin-stripe': CreditCard,
  'kast-plugin-resend': Mail,
  'kast-plugin-r2': Cloud,
  'kast-plugin-sentry': ShieldAlert,
};

/** Shared so the skeleton and the real grid keep exactly the same rhythm. */
const GRID_CLASSES = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3';

function StatusBadge({ isActive }: { isActive: boolean }): JSX.Element {
  const t = useTranslations('plugins.status');
  return (
    <Badge variant={isActive ? 'success' : 'muted'} dot>
      {isActive ? t('enabled') : t('disabled')}
    </Badge>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

interface PluginCardProps {
  plugin: PluginRecord;
  busy: boolean;
  onToggle: () => void;
}

function PluginCard({ plugin, busy, onToggle }: PluginCardProps): JSX.Element {
  const t = useTranslations('plugins');
  const Icon = PLUGIN_ICONS[plugin.name] ?? Puzzle;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-lg [&_svg]:size-5',
              plugin.isActive
                ? 'bg-primary-subtle text-primary-subtle-foreground'
                : 'bg-muted text-muted-foreground',
            )}
          >
            <Icon />
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate">{plugin.displayName}</CardTitle>
            <p className="truncate font-mono text-2xs text-muted-foreground">
              {plugin.name} · v{plugin.version}
            </p>
          </div>
        </div>
        <CardAction>
          <StatusBadge isActive={plugin.isActive} />
        </CardAction>
      </CardHeader>

      <CardContent className="flex-1 pt-4 pb-4">
        <p className="line-clamp-2 text-sm text-muted-foreground">{plugin.description ?? '—'}</p>
      </CardContent>

      <CardFooter className="justify-between gap-3">
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {t('table.installed')} · {formatDate(plugin.installedAt)}
        </span>
        <Button
          variant={plugin.isActive ? 'outline' : 'subtle'}
          size="sm"
          loading={busy}
          disabled={plugin.isSystemPlugin}
          onClick={onToggle}
        >
          {plugin.isActive ? t('actions.disable') : t('actions.enable')}
        </Button>
      </CardFooter>
    </Card>
  );
}

/** Placeholder cards so the grid keeps its shape while the first load runs. */
function PluginsGridSkeleton(): JSX.Element {
  return (
    <div className={GRID_CLASSES}>
      {Array.from({ length: 6 }, (_, i) => (
        <Card key={i} className="flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <CardAction>
              <Skeleton className="h-5 w-16 rounded-md" />
            </CardAction>
          </CardHeader>
          <CardContent className="flex-1 space-y-2 pt-4 pb-4">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-3/5" />
          </CardContent>
          <CardFooter className="justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

export function PluginsPageClient(): JSX.Element {
  const client = useApiClient();
  const t = useTranslations('plugins');
  const { session } = useSession();
  const [plugins, setPlugins] = useState<PluginRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await client.plugins.list();
      setPlugins(res.data);
    } finally {
      setLoading(false);
    }
  }, [session, client]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(
    async (plugin: PluginRecord): Promise<void> => {
      if (!session) return;
      setBusy(plugin.name);
      try {
        const action = plugin.isActive ? client.plugins.disable : client.plugins.enable;
        await action.call(client.plugins, plugin.name);
        await load();
      } finally {
        setBusy(null);
      }
    },
    [session, load, client],
  );

  const activeCount = plugins.filter((plugin) => plugin.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        actions={
          !loading && plugins.length > 0 ? (
            <Badge variant={activeCount > 0 ? 'success' : 'muted'} size="lg" dot>
              {activeCount} {t('status.enabled')}
            </Badge>
          ) : undefined
        }
      />

      {loading && (
        <>
          <span className="sr-only" role="status">
            {t('loading')}
          </span>
          <PluginsGridSkeleton />
        </>
      )}

      {!loading && plugins.length === 0 && <EmptyState Icon={Puzzle} title={t('empty')} />}

      {!loading && plugins.length > 0 && (
        <div className={GRID_CLASSES}>
          {plugins.map((plugin) => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              busy={busy === plugin.name}
              onToggle={() => void toggle(plugin)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

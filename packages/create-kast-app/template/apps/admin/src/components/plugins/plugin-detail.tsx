'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiClient, useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import type { PluginRecord } from '@kast-cms/sdk';
import {
  CheckCircle,
  Cloud,
  CreditCard,
  Mail,
  Puzzle,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState, type JSX } from 'react';

const PLUGIN_ICONS: Record<string, JSX.Element> = {
  'kast-plugin-meilisearch': <Search className="size-5" />,
  'kast-plugin-stripe': <CreditCard className="size-5" />,
  'kast-plugin-resend': <Mail className="size-5" />,
  'kast-plugin-r2': <Cloud className="size-5" />,
  'kast-plugin-sentry': <ShieldAlert className="size-5" />,
};

/**
 * Mirrors the `env` array in each plugin's kast-plugin.json. Kept in sync by
 * hand — the plugin API does not surface the manifest's env list yet.
 */
const PLUGIN_ENV_VARS: Record<string, string[]> = {
  'kast-plugin-meilisearch': [
    'MEILISEARCH_HOST',
    'MEILISEARCH_MASTER_KEY',
    'MEILISEARCH_INDEX_PREFIX',
    'MEILISEARCH_AGGREGATE_INDEX',
    'KAST_API_URL',
    'KAST_API_TOKEN',
  ],
  'kast-plugin-stripe': [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRODUCT_TYPE_SLUG',
    'KAST_API_URL',
    'KAST_API_TOKEN',
  ],
  'kast-plugin-resend': ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'RESEND_FROM_NAME'],
  'kast-plugin-r2': [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_PUBLIC_URL',
  ],
  'kast-plugin-sentry': ['SENTRY_DSN', 'SENTRY_ENVIRONMENT', 'SENTRY_TRACES_SAMPLE_RATE'],
};

interface PluginConfig {
  provider?: string;
  configuredAt?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Sub-components (extracted to keep PluginDetailClient within line/complexity limits)
// ---------------------------------------------------------------------------

interface PluginHeaderProps {
  plugin: PluginRecord;
  icon: JSX.Element;
  busy: boolean;
  onToggle: () => void;
}

function PluginHeader({ plugin, icon, busy, onToggle }: PluginHeaderProps): JSX.Element {
  const hasDescription = plugin.description !== null && plugin.description !== '';
  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className={cn(
              'grid size-11 shrink-0 place-items-center rounded-lg',
              plugin.isActive
                ? 'bg-primary-subtle text-primary-subtle-foreground'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate text-lg">{plugin.displayName}</CardTitle>
            <p className="truncate font-mono text-2xs text-muted-foreground">
              {plugin.name} · v{plugin.version}
            </p>
          </div>
        </div>
        <CardAction>
          <Badge variant={plugin.isActive ? 'success' : 'muted'} dot>
            {plugin.isActive ? 'Enabled' : 'Disabled'}
          </Badge>
          {!plugin.isSystemPlugin && (
            <Button
              variant={plugin.isActive ? 'outline' : 'subtle'}
              size="sm"
              loading={busy}
              onClick={onToggle}
            >
              {plugin.isActive ? 'Disable' : 'Enable'}
            </Button>
          )}
        </CardAction>
      </CardHeader>
      {hasDescription && (
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">{plugin.description}</p>
        </CardContent>
      )}
    </Card>
  );
}

interface ConfigStatusProps {
  config: PluginConfig | null;
  isActive: boolean;
}

function ConfigStatus({ config, isActive }: ConfigStatusProps): JSX.Element {
  if (config !== null) {
    const configuredAt = config.configuredAt
      ? new Date(config.configuredAt).toLocaleString()
      : null;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="size-4 shrink-0 text-success" />
            Active Configuration
          </CardTitle>
          {configuredAt !== null && <CardDescription>Configured on {configuredAt}</CardDescription>}
        </CardHeader>
        <CardContent className="pt-4">
          <pre className="overflow-x-auto rounded-md border border-border bg-muted px-4 py-3 text-xs break-all whitespace-pre-wrap text-muted-foreground">
            {JSON.stringify(config, null, 2)}
          </pre>
        </CardContent>
      </Card>
    );
  }
  if (isActive) {
    return (
      <Alert variant="warning">
        <AlertDescription>
          This plugin is enabled but has not persisted any configuration yet. Ensure the required
          environment variables are set and restart the API.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert icon={<XCircle className="size-4 translate-y-0.5" />}>
      <AlertDescription>
        Enable this plugin to activate its functionality. Make sure all required environment
        variables are set in your API configuration.
      </AlertDescription>
    </Alert>
  );
}

/** Placeholder cards so the screen keeps its shape while the plugin loads. */
function PluginDetailSkeleton(): JSX.Element {
  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <CardAction>
            <Skeleton className="h-5 w-16 rounded-md" />
          </CardAction>
        </CardHeader>
        <CardContent className="pt-4">
          <Skeleton className="h-3.5 w-3/4" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-44" />
        </CardHeader>
        <CardContent className="space-y-2 pt-4">
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface PluginDetailClientProps {
  pluginId: string;
}

export function PluginDetailClient({ pluginId }: PluginDetailClientProps): JSX.Element {
  const client = useApiClient();
  const { session } = useSession();
  const [plugin, setPlugin] = useState<PluginRecord | null>(null);
  const [config, setConfig] = useState<PluginConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await client.plugins.list();
      const found = res.data.find((p) => p.name === pluginId);
      if (found) {
        setPlugin(found);
        try {
          const cfgRes = await client.plugins.getConfig(pluginId);
          setConfig(cfgRes.data as PluginConfig);
        } catch {
          setConfig(null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [session, pluginId, client]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(async (): Promise<void> => {
    if (!session) return;
    if (!plugin) return;
    setBusy(true);
    try {
      if (plugin.isActive) {
        await client.plugins.disable(plugin.name);
      } else {
        await client.plugins.enable(plugin.name);
      }
      await load();
    } finally {
      setBusy(false);
    }
  }, [session, plugin, load, client]);

  if (loading) {
    return <PluginDetailSkeleton />;
  }

  if (!plugin) {
    return (
      <EmptyState
        Icon={Puzzle}
        title="Plugin not installed"
        description={`No plugin named “${pluginId}” is installed on this instance.`}
      />
    );
  }

  const envVars = PLUGIN_ENV_VARS[pluginId] ?? [];
  const icon = PLUGIN_ICONS[pluginId] ?? <Puzzle className="size-5" />;

  return (
    <div className="max-w-3xl space-y-6">
      <PluginHeader plugin={plugin} icon={icon} busy={busy} onToggle={() => void toggle()} />
      {envVars.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Environment Variables</CardTitle>
            <CardDescription>Required environment variables for this plugin.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <ul className="space-y-2">
              {envVars.map((envKey) => (
                <li
                  key={envKey}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2"
                >
                  <code className="truncate font-mono text-xs text-foreground">{envKey}</code>
                  <Badge variant="muted" size="sm">
                    Required
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <ConfigStatus config={config} isActive={plugin.isActive} />
    </div>
  );
}

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { PluginRecord } from '@kast-cms/sdk';
import {
  AlertTriangle,
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
  'kast-plugin-meilisearch': <Search className="h-6 w-6" />,
  'kast-plugin-stripe': <CreditCard className="h-6 w-6" />,
  'kast-plugin-resend': <Mail className="h-6 w-6" />,
  'kast-plugin-r2': <Cloud className="h-6 w-6" />,
  'kast-plugin-sentry': <ShieldAlert className="h-6 w-6" />,
};

const PLUGIN_ENV_VARS: Record<string, string[]> = {
  'kast-plugin-meilisearch': [
    'MEILISEARCH_HOST',
    'MEILISEARCH_MASTER_KEY',
    'MEILISEARCH_INDEX_PREFIX',
  ],
  'kast-plugin-stripe': ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRODUCT_TYPE_SLUG'],
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
  const badgeVariant = plugin.isActive ? 'default' : ('outline' as const);
  const badgeClass = plugin.isActive ? '' : 'border-muted-foreground text-muted-foreground';
  const desc = plugin.description ? ` — ${plugin.description}` : '';
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg border p-2 text-muted-foreground">{icon}</div>
          <div>
            <h2 className="text-lg font-semibold leading-none tracking-tight">
              {plugin.displayName}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              v{plugin.version}
              {desc}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={badgeVariant} className={badgeClass}>
            {plugin.isActive ? 'Enabled' : 'Disabled'}
          </Badge>
          {!plugin.isSystemPlugin && (
            <Button variant="outline" size="sm" disabled={busy} onClick={onToggle}>
              {plugin.isActive ? 'Disable' : 'Enable'}
            </Button>
          )}
        </div>
      </div>
    </div>
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
      <div className="rounded-lg border bg-card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <h3 className="text-sm font-medium">Active Configuration</h3>
        </div>
        {configuredAt && (
          <p className="text-xs text-muted-foreground">Configured on {configuredAt}</p>
        )}
        <pre className="rounded-md bg-muted px-4 py-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(config, null, 2)}
        </pre>
      </div>
    );
  }
  if (isActive) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-4 flex items-center gap-2 text-amber-700 dark:text-amber-400">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <p className="text-sm">
          This plugin is enabled but has not persisted any configuration yet. Ensure the required
          environment variables are set and restart the API.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border p-4 flex items-center gap-2 text-muted-foreground">
      <XCircle className="h-4 w-4 shrink-0" />
      <p className="text-sm">
        Enable this plugin to activate its functionality. Make sure all required environment
        variables are set in your API configuration.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface PluginDetailClientProps {
  pluginId: string;
}

export function PluginDetailClient({ pluginId }: PluginDetailClientProps): JSX.Element {
  const { session } = useSession();
  const [plugin, setPlugin] = useState<PluginRecord | null>(null);
  const [config, setConfig] = useState<PluginConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (!session) return;
    setLoading(true);
    try {
      const client = createApiClient(session.accessToken);
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
  }, [session, pluginId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(async (): Promise<void> => {
    if (!session) return;
    if (!plugin) return;
    setBusy(true);
    try {
      const client = createApiClient(session.accessToken);
      if (plugin.isActive) {
        await client.plugins.disable(plugin.name);
      } else {
        await client.plugins.enable(plugin.name);
      }
      await load();
    } finally {
      setBusy(false);
    }
  }, [session, plugin, load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (!plugin) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
        <Puzzle className="h-10 w-10 opacity-40" />
        <p className="text-sm">
          Plugin <code className="font-mono">{pluginId}</code> is not installed.
        </p>
      </div>
    );
  }

  const envVars = PLUGIN_ENV_VARS[pluginId] ?? [];
  const icon = PLUGIN_ICONS[pluginId] ?? <Puzzle className="h-6 w-6" />;

  return (
    <div className="space-y-6 max-w-2xl">
      <PluginHeader plugin={plugin} icon={icon} busy={busy} onToggle={() => void toggle()} />
      {envVars.length > 0 && (
        <div className="rounded-lg border bg-card p-6 space-y-3">
          <div>
            <h3 className="text-sm font-medium">Environment Variables</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Required environment variables for this plugin.
            </p>
          </div>
          <ul className="space-y-2">
            {envVars.map((envKey) => (
              <li
                key={envKey}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <code className="font-mono text-xs">{envKey}</code>
                <span className="text-muted-foreground text-xs">Required</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ConfigStatus config={config} isActive={plugin.isActive} />
    </div>
  );
}

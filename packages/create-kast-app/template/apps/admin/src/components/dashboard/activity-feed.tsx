'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { DashboardActivityEntry } from '@kast-cms/sdk';
import { History } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function actorLabel(entry: DashboardActivityEntry, agentLabel: string): string {
  if (entry.user) {
    const name = [entry.user.firstName, entry.user.lastName].filter(Boolean).join(' ');
    return name || entry.user.email;
  }
  if (entry.agentName) return `${agentLabel}: ${entry.agentName}`;
  return entry.ipAddress ?? 'System';
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * Destructive actions should be findable at a glance in a long feed, so the
 * timeline dot is tinted by what the entry actually did rather than being a
 * decorative brand colour on every row.
 */
function dotToneClass(action: string): string {
  const normalized = action.toLowerCase();
  if (normalized.includes('delete') || normalized.includes('destroy')) return 'bg-destructive';
  if (normalized.includes('publish') || normalized.includes('create')) return 'bg-success';
  if (normalized.includes('update') || normalized.includes('edit')) return 'bg-info';
  return 'bg-primary';
}

interface ActivityFeedProps {
  entries: DashboardActivityEntry[];
}

export function ActivityFeed({ entries }: ActivityFeedProps): JSX.Element {
  const t = useTranslations('dashboard.activity');

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-sm">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 items-center pt-4">
        {entries.length === 0 ? (
          <EmptyState Icon={History} title={t('empty')} size="sm" className="w-full" />
        ) : (
          <ol className="max-h-72 w-full overflow-y-auto pe-1">
            {entries.slice(0, 15).map((entry) => (
              <li key={entry.id} className="group flex gap-3">
                {/* Rail: dot, then a hairline running down to the next entry. */}
                <div className="flex w-2 shrink-0 flex-col items-center" aria-hidden="true">
                  <span
                    className={cn(
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      dotToneClass(entry.action),
                    )}
                  />
                  <span className="my-1 w-px flex-1 bg-border group-last:hidden" />
                </div>
                <div className="min-w-0 flex-1 pb-4 group-last:pb-0">
                  <p className="truncate text-sm font-medium">
                    {formatAction(entry.action)}{' '}
                    <span className="font-normal text-muted-foreground">
                      {entry.resource}
                      {entry.resourceId !== null ? ` #${entry.resourceId}` : ''}
                    </span>
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                    <span className="truncate">{actorLabel(entry, t('agent'))}</span>
                    <span aria-hidden="true">·</span>
                    <time dateTime={entry.createdAt}>{relativeTime(entry.createdAt)}</time>
                    {entry.isDryRun && (
                      <Badge variant="warning" size="sm">
                        {t('dryRun')}
                      </Badge>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

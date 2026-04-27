'use client';

import type { DashboardActivityEntry } from '@kast-cms/sdk';
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

interface ActivityFeedProps {
  entries: DashboardActivityEntry[];
}

export function ActivityFeed({ entries }: ActivityFeedProps): JSX.Element {
  const t = useTranslations('dashboard.activity');

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-5 shadow-sm dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
          {t('title')}
        </h2>
        <p className="text-sm text-gray-400">{t('empty')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm dark:bg-gray-900">
      <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">{t('title')}</h2>
      <ul className="max-h-72 space-y-2 overflow-y-auto">
        {entries.slice(0, 15).map((entry) => (
          <li key={entry.id} className="flex items-start gap-2 border-b pb-2 last:border-0">
            <span className="mt-0.5 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-indigo-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                {formatAction(entry.action)}{' '}
                <span className="font-normal text-gray-500">
                  {entry.resource}
                  {entry.resourceId !== null ? ` #${entry.resourceId}` : ''}
                </span>
              </p>
              <p className="text-xs text-gray-400">
                {actorLabel(entry, t('agent'))}
                {entry.isDryRun && <span className="ml-1 text-amber-500">({t('dryRun')})</span>}
                {' · '}
                {relativeTime(entry.createdAt)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

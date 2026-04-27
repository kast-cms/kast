'use client';

import type { DashboardStats } from '@kast/sdk';
import { FileText, Image, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';

interface StatCardProps {
  icon: JSX.Element;
  label: string;
  value: number | string;
  sub?: string;
}

function StatCard({ icon, label, value, sub }: StatCardProps): JSX.Element {
  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {sub !== undefined && <p className="text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

interface StatCardsProps {
  stats: DashboardStats;
}

export function StatCards({ stats }: StatCardsProps): JSX.Element {
  const t = useTranslations('dashboard.stats');

  const sizeLabel = t('totalSize', { size: stats.media.totalSizeMb });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={<FileText size={20} />}
        label={t('publishedEntries')}
        value={stats.contentEntries.byStatus.published}
      />
      <StatCard
        icon={<FileText size={20} />}
        label={t('draftEntries')}
        value={stats.contentEntries.byStatus.draft}
      />
      <StatCard
        icon={<Image size={20} />}
        label={t('mediaFiles')}
        value={stats.media.total}
        sub={sizeLabel}
      />
      <StatCard icon={<Users size={20} />} label={t('activeUsers')} value={stats.users.active} />
    </div>
  );
}

'use client';

import { useSession } from '@/lib/session';
import type { DashboardActivityEntry, DashboardQueueHealth, DashboardStats } from '@kast/sdk';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';
import { ActivityFeed } from './activity-feed';
import { EntryStatusChart, SeoScoreChart } from './dashboard-charts';
import { OnboardingChecklist } from './onboarding-checklist';
import { QueueHealthTable } from './queue-health-table';
import { QuickActions } from './quick-actions';
import { StatCards } from './stat-cards';
import { useDashboard } from './use-dashboard';

interface DashboardContentProps {
  stats: DashboardStats;
  activity: DashboardActivityEntry[];
  queueHealth: DashboardQueueHealth[];
  isAdmin: boolean;
}

function DashboardContent({
  stats,
  activity,
  queueHealth,
  isAdmin,
}: DashboardContentProps): JSX.Element {
  return (
    <>
      <StatCards stats={stats} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <EntryStatusChart content={stats.contentEntries} />
        <SeoScoreChart seo={stats.seo} />
        <ActivityFeed entries={activity} />
      </div>
      {isAdmin && queueHealth.length > 0 && <QueueHealthTable queues={queueHealth} />}
    </>
  );
}

function Skeleton(): JSX.Element {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-44 rounded-lg bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>
    </div>
  );
}

interface HeaderProps {
  title: string;
  welcome: string;
  firstName: string;
  isAdmin: boolean;
}

function DashboardHeader({ title, welcome, firstName, isAdmin }: HeaderProps): JSX.Element {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        {firstName && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {welcome}, {firstName}
          </p>
        )}
      </div>
      <QuickActions isAdmin={isAdmin} />
    </div>
  );
}

// eslint-disable-next-line complexity
export function DashboardPage(): JSX.Element {
  const t = useTranslations('dashboard');
  const { session } = useSession();
  const { stats, activity, queueHealth, loading, isAdmin } = useDashboard();

  const firstName = session?.user.firstName ?? session?.user.email ?? '';
  const isEmpty = stats !== null && stats.contentEntries.total === 0;

  return (
    <div className="space-y-6 p-6">
      <DashboardHeader
        title={t('title')}
        welcome={t('welcome')}
        firstName={firstName}
        isAdmin={isAdmin}
      />
      {loading && <Skeleton />}
      {!loading && isEmpty && <OnboardingChecklist />}
      {!loading && stats !== null && (
        <DashboardContent
          stats={stats}
          activity={activity}
          queueHealth={queueHealth}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}

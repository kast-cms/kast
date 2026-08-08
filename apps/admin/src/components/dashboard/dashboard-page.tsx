'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { useSession } from '@/lib/session';
import type { Session } from '@/types';
import type { DashboardActivityEntry, DashboardQueueHealth, DashboardStats } from '@kast-cms/sdk';
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <EntryStatusChart content={stats.contentEntries} />
        <SeoScoreChart seo={stats.seo} />
        <ActivityFeed entries={activity} />
      </div>
      {isAdmin && queueHealth.length > 0 && <QueueHealthTable queues={queueHealth} />}
    </>
  );
}

/**
 * Mirrors the real layout — four stat cards over three panels — so the page
 * does not visibly reflow when the data lands.
 */
function DashboardSkeleton(): JSX.Element {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="flex items-start justify-between gap-3">
              <div className="w-full space-y-2.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-14" />
              </div>
              <Skeleton className="size-9 shrink-0 rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="pt-4">
              <SkeletonText lines={4} />
            </CardContent>
          </Card>
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
    <PageHeader
      title={title}
      description={firstName ? `${welcome}, ${firstName}` : undefined}
      actions={<QuickActions isAdmin={isAdmin} />}
    />
  );
}

/** What to call the signed-in user. The token often carries no name, so the
 *  email is the realistic fallback. */
function greetingName(session: Session | null): string {
  return session?.user.firstName ?? session?.user.email ?? '';
}

export function DashboardPage(): JSX.Element {
  const t = useTranslations('dashboard');
  const { session } = useSession();
  const { stats, activity, queueHealth, loading, isAdmin } = useDashboard();

  const firstName = greetingName(session);
  const isEmpty = stats !== null && stats.contentEntries.total === 0;

  return (
    <div className="space-y-6">
      <DashboardHeader
        title={t('title')}
        welcome={t('welcome')}
        firstName={firstName}
        isAdmin={isAdmin}
      />
      {loading && <DashboardSkeleton />}
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

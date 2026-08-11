'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { DashboardStats } from '@kast-cms/sdk';
import { FileText, Image, PencilLine, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';

/**
 * Tone drives the icon tile only. Published/draft/media/users each get a
 * distinct tint so the row can be scanned by colour, and the tint is
 * semantically honest: drafts are "pending", published is "live".
 */
type StatTone = 'success' | 'warning' | 'info' | 'brand';

const TONE_TILE: Record<StatTone, string> = {
  success: 'bg-success-subtle text-success-subtle-foreground',
  warning: 'bg-warning-subtle text-warning-subtle-foreground',
  info: 'bg-info-subtle text-info-subtle-foreground',
  brand: 'bg-primary-subtle text-primary-subtle-foreground',
};

interface StatCardProps {
  icon: JSX.Element;
  label: string;
  value: number | string;
  sub?: string;
  tone: StatTone;
}

function StatCard({ icon, label, value, sub, tone }: StatCardProps): JSX.Element {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl leading-none font-semibold tracking-tight tabular-nums">{value}</p>
          {sub !== undefined && (
            <p className="truncate pt-0.5 text-xs text-muted-foreground">{sub}</p>
          )}
        </div>
        <span
          aria-hidden="true"
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-lg [&_svg]:size-4.5',
            TONE_TILE[tone],
          )}
        >
          {icon}
        </span>
      </CardContent>
    </Card>
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
        icon={<FileText />}
        tone="success"
        label={t('publishedEntries')}
        value={stats.contentEntries.byStatus.published}
      />
      <StatCard
        icon={<PencilLine />}
        tone="warning"
        label={t('draftEntries')}
        value={stats.contentEntries.byStatus.draft}
      />
      <StatCard
        icon={<Image />}
        tone="info"
        label={t('mediaFiles')}
        value={stats.media.total}
        sub={sizeLabel}
      />
      <StatCard icon={<Users />} tone="brand" label={t('activeUsers')} value={stats.users.active} />
    </div>
  );
}

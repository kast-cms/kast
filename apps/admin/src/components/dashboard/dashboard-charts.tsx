'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { DashboardContentStats, DashboardSeoStats } from '@kast-cms/sdk';
import { BarChart3, PieChart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';

/* ── Donut chart ─────────────────────────────────────────────── */

interface DonutSegment {
  value: number;
  /** `stroke-*` utility for the arc. */
  stroke: string;
  /** `bg-*` utility for the matching legend swatch. */
  swatch: string;
  label: string;
}

function DonutChart({ segments, total }: { segments: DonutSegment[]; total: number }): JSX.Element {
  const r = 40;
  const cx = 50;
  const cy = 50;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  const arcs = segments.map((seg) => {
    const frac = total > 0 ? seg.value / total : 0;
    const dash = frac * circumference;
    const arc = { ...seg, dash, offset };
    offset += dash;
    return arc;
  });

  return (
    <div className="flex items-center gap-5">
      <div className="relative size-24 shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
          {/* Track first, so gaps read as "unfilled" rather than as a hole. */}
          <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={14} className="stroke-muted" />
          {arcs.map((arc, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              strokeWidth={14}
              strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
              strokeDashoffset={-arc.offset}
              className={arc.stroke}
            />
          ))}
        </svg>
        <span className="absolute inset-0 grid place-items-center text-md font-semibold tabular-nums">
          {total}
        </span>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center gap-2 text-xs">
            <span aria-hidden="true" className={cn('size-2.5 shrink-0 rounded-xs', seg.swatch)} />
            <span className="truncate text-muted-foreground">{seg.label}</span>
            <span className="ms-auto font-semibold tabular-nums">{seg.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Bar chart ───────────────────────────────────────────────── */

interface BarSegment {
  value: number;
  /** `bg-*` utility for the bar. */
  bar: string;
  label: string;
}

function BarChart({ segments }: { segments: BarSegment[] }): JSX.Element {
  const max = Math.max(...segments.map((s) => s.value), 1);

  return (
    <div className="flex items-end gap-4">
      {segments.map((seg) => (
        <div key={seg.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <span className="text-xs font-semibold tabular-nums">{seg.value}</span>
          {/* Fixed-height lane so the percentage height always resolves. */}
          <div className="flex h-20 w-full items-end rounded-sm bg-muted/60">
            <div
              className={cn(
                'w-full rounded-sm transition-[height] duration-500 ease-spring',
                seg.bar,
              )}
              style={{ height: `${Math.max((seg.value / max) * 100, seg.value > 0 ? 6 : 0)}%` }}
            />
          </div>
          <span className="w-full truncate text-center text-2xs text-muted-foreground">
            {seg.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Entry status donut ──────────────────────────────────────── */

interface EntryStatusChartProps {
  content: DashboardContentStats;
}

export function EntryStatusChart({ content }: EntryStatusChartProps): JSX.Element {
  const t = useTranslations('dashboard.charts');
  // Reuses the same status labels the entry list and StatusBadge already use,
  // so the legend is translated and cannot drift from the rest of the UI.
  const tStatus = useTranslations('content.status');

  const segments: DonutSegment[] = [
    {
      value: content.byStatus.published,
      stroke: 'stroke-chart-1',
      swatch: 'bg-chart-1',
      label: tStatus('PUBLISHED'),
    },
    {
      value: content.byStatus.draft,
      stroke: 'stroke-chart-4',
      swatch: 'bg-chart-4',
      label: tStatus('DRAFT'),
    },
    {
      value: content.byStatus.scheduled,
      stroke: 'stroke-chart-2',
      swatch: 'bg-chart-2',
      label: tStatus('SCHEDULED'),
    },
    {
      value: content.byStatus.archived,
      stroke: 'stroke-border-strong',
      swatch: 'bg-border-strong',
      label: tStatus('ARCHIVED'),
    },
  ];

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-sm">{t('entryStatusTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 items-center pt-4">
        {content.total === 0 ? (
          <EmptyState Icon={PieChart} title={t('noData')} size="sm" className="w-full" />
        ) : (
          <DonutChart segments={segments} total={content.total} />
        )}
      </CardContent>
    </Card>
  );
}

/* ── SEO score bar chart ─────────────────────────────────────── */

interface SeoScoreChartProps {
  seo: DashboardSeoStats;
}

function scoreToneClass(score: number): string {
  if (score >= 75) return 'text-success';
  if (score >= 50) return 'text-warning';
  return 'text-destructive';
}

export function SeoScoreChart({ seo }: SeoScoreChartProps): JSX.Element {
  const t = useTranslations('dashboard.charts');
  const tSeo = useTranslations('dashboard.seo');

  const segments: BarSegment[] = [
    { value: seo.scoreDistribution.below50, bar: 'bg-chart-5', label: t('below50') },
    { value: seo.scoreDistribution.between50and74, bar: 'bg-chart-4', label: t('between50and74') },
    { value: seo.scoreDistribution.above74, bar: 'bg-chart-3', label: t('above74') },
  ];
  const total =
    seo.scoreDistribution.below50 +
    seo.scoreDistribution.between50and74 +
    seo.scoreDistribution.above74;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-sm">{t('seoScoreTitle')}</CardTitle>
        <CardDescription>
          {tSeo('averageScore')}:{' '}
          <span className={cn('font-semibold tabular-nums', scoreToneClass(seo.averageScore))}>
            {seo.averageScore}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 items-center pt-4">
        {total === 0 ? (
          <EmptyState Icon={BarChart3} title={t('noData')} size="sm" className="w-full" />
        ) : (
          <div className="w-full">
            <BarChart segments={segments} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

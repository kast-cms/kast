'use client';

import type { DashboardContentStats, DashboardSeoStats } from '@kast/sdk';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';

/* ── Donut chart ─────────────────────────────────────────────── */

interface DonutSegment {
  value: number;
  color: string;
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
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="h-24 w-24 flex-shrink-0 -rotate-90">
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={18}
            strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
            strokeDashoffset={-arc.offset}
          />
        ))}
        {total === 0 && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={18} />
        )}
      </svg>
      <ul className="flex flex-col gap-1">
        {segments.map((seg) => (
          <li
            key={seg.label}
            className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: seg.color }}
            />
            {seg.label}: <span className="font-semibold">{seg.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Bar chart ───────────────────────────────────────────────── */

interface BarSegment {
  value: number;
  color: string;
  label: string;
}

function BarChart({ segments }: { segments: BarSegment[] }): JSX.Element {
  const max = Math.max(...segments.map((s) => s.value), 1);
  return (
    <div className="flex h-24 items-end gap-3">
      {segments.map((seg) => (
        <div key={seg.label} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
            {seg.value}
          </span>
          <div
            className="w-full rounded-t"
            style={{ height: `${Math.round((seg.value / max) * 64)}px`, background: seg.color }}
          />
          <span className="text-[10px] text-gray-500">{seg.label}</span>
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

  const segments: DonutSegment[] = [
    { value: content.byStatus.published, color: '#6366f1', label: 'Published' },
    { value: content.byStatus.draft, color: '#f59e0b', label: 'Draft' },
    { value: content.byStatus.scheduled, color: '#3b82f6', label: 'Scheduled' },
    { value: content.byStatus.archived, color: '#9ca3af', label: 'Archived' },
  ];

  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm dark:bg-gray-900">
      <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-200">
        {t('entryStatusTitle')}
      </h2>
      {content.total === 0 ? (
        <p className="text-sm text-gray-400">{t('noData')}</p>
      ) : (
        <DonutChart segments={segments} total={content.total} />
      )}
    </div>
  );
}

/* ── SEO score bar chart ─────────────────────────────────────── */

interface SeoScoreChartProps {
  seo: DashboardSeoStats;
}

export function SeoScoreChart({ seo }: SeoScoreChartProps): JSX.Element {
  const t = useTranslations('dashboard.charts');
  const tSeo = useTranslations('dashboard.seo');

  const segments: BarSegment[] = [
    { value: seo.scoreDistribution.below50, color: '#ef4444', label: t('below50') },
    { value: seo.scoreDistribution.between50and74, color: '#f59e0b', label: t('between50and74') },
    { value: seo.scoreDistribution.above74, color: '#22c55e', label: t('above74') },
  ];
  const total =
    seo.scoreDistribution.below50 +
    seo.scoreDistribution.between50and74 +
    seo.scoreDistribution.above74;

  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm dark:bg-gray-900">
      <h2 className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-200">
        {t('seoScoreTitle')}
      </h2>
      <p className="mb-4 text-xs text-gray-400">
        {tSeo('averageScore')}: {seo.averageScore}
      </p>
      {total === 0 ? (
        <p className="text-sm text-gray-400">{t('noData')}</p>
      ) : (
        <BarChart segments={segments} />
      )}
    </div>
  );
}

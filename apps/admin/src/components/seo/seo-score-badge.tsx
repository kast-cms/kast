'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { SeoIssue, SeoScore } from '@kast/sdk';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';

interface SeoScoreBadgeProps {
  score: SeoScore | null;
  loading?: boolean;
}

function scoreColorClass(value: number): string {
  if (value >= 75) return 'bg-green-100 text-green-800';
  if (value >= 50) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

function severityClass(severity: SeoIssue['severity']): string {
  if (severity === 'ERROR') return 'text-red-600';
  if (severity === 'WARNING') return 'text-amber-600';
  return 'text-blue-600';
}

export function SeoScoreBadge({ score, loading }: SeoScoreBadgeProps): JSX.Element {
  const t = useTranslations('seo.score');
  const [open, setOpen] = useState(false);

  if (loading) {
    return <Badge variant="secondary">…</Badge>;
  }

  if (!score) {
    return <span className="text-sm text-muted-foreground">{t('noScore')}</span>;
  }

  const colorClass = scoreColorClass(score.score);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={`rounded-full px-3 py-1 text-sm font-semibold ${colorClass}`}
        onClick={(): void => setOpen(true)}
      >
        {score.score} / 100
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-96">
          <SheetHeader>
            <SheetTitle>{t('issuesTitle')}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {score.issues.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noIssues')}</p>
            ) : (
              score.issues.map((issue) => (
                <div key={issue.id} className="rounded border p-3 text-sm">
                  <div className={`font-semibold ${severityClass(issue.severity)}`}>
                    {issue.severity} — {issue.type}
                  </div>
                  <div className="text-muted-foreground">{issue.message}</div>
                  <div className="text-xs text-muted-foreground">Penalty: -{issue.penalty}</div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

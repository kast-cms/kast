'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { IssueSeverity, SeoScore } from '@kast-cms/sdk';
import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';

interface SeoScoreBadgeProps {
  score: SeoScore | null;
  loading?: boolean;
}

/**
 * Score banding. 75+ is a healthy page, 50–74 needs attention, anything below
 * is failing — so the chip carries real signal rather than decoration.
 */
type ScoreTone = 'success' | 'warning' | 'destructive';

function scoreTone(value: number): ScoreTone {
  if (value >= 75) return 'success';
  if (value >= 50) return 'warning';
  return 'destructive';
}

const SCORE_CHIP: Record<ScoreTone, string> = {
  success: 'bg-success-subtle text-success-subtle-foreground hover:bg-success-subtle/70',
  warning: 'bg-warning-subtle text-warning-subtle-foreground hover:bg-warning-subtle/70',
  destructive:
    'bg-destructive-subtle text-destructive-subtle-foreground hover:bg-destructive-subtle/70',
};

/** Issue severity maps straight onto the status palette. */
const SEVERITY_VARIANT: Record<IssueSeverity, 'destructive' | 'warning' | 'info'> = {
  ERROR: 'destructive',
  WARNING: 'warning',
  INFO: 'info',
};

export function SeoScoreBadge({ score, loading }: SeoScoreBadgeProps): JSX.Element {
  const t = useTranslations('seo.score');
  const [open, setOpen] = useState(false);

  if (loading === true) {
    return <Skeleton className="h-8 w-24 rounded-full" />;
  }

  if (!score) {
    return <span className="text-sm text-muted-foreground">{t('noScore')}</span>;
  }

  const tone = scoreTone(score.score);
  const issueCount = score.issues.length;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={cn('rounded-full px-3 font-semibold tabular-nums', SCORE_CHIP[tone])}
        onClick={(): void => setOpen(true)}
      >
        {score.score} / 100
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-96">
          <SheetHeader>
            <SheetTitle>{t('issuesTitle')}</SheetTitle>
          </SheetHeader>
          <SheetBody className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl font-semibold tabular-nums text-foreground">
                  {score.score} / 100
                </span>
                {issueCount > 0 && <Badge variant="muted">{issueCount}</Badge>}
              </div>
              <Progress value={score.score} tone={tone} label={t('label')} />
            </div>

            {issueCount === 0 ? (
              <EmptyState Icon={ShieldCheck} size="sm" title={t('noIssues')} />
            ) : (
              <ul className="space-y-2">
                {score.issues.map((issue) => (
                  <li
                    key={issue.id}
                    className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={SEVERITY_VARIANT[issue.severity]} dot>
                        {issue.severity}
                      </Badge>
                      <span className="truncate font-mono text-2xs text-muted-foreground">
                        {issue.type}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{issue.message}</p>
                    <p className="text-2xs tabular-nums text-muted-foreground">
                      Penalty: -{issue.penalty}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}

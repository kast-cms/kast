'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import type { FormSubmissionSummary } from '@kast-cms/sdk';
import { Inbox } from 'lucide-react';
import { type useTranslations } from 'next-intl';
import type { JSX } from 'react';

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

interface SubmissionDetailDialogProps {
  submission: FormSubmissionSummary | null;
  t: ReturnType<typeof useTranslations<'forms.submissions'>>;
  onClose: () => void;
  onDelete: (subId: string) => void;
}

export function SubmissionDetailDialog({
  submission,
  t,
  onClose,
  onDelete,
}: SubmissionDetailDialogProps): JSX.Element {
  const entries = submission !== null ? Object.entries(submission.data) : [];

  return (
    <Dialog
      open={submission !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('detail.title')}</DialogTitle>
          {submission !== null && (
            <DialogDescription>
              {t('detail.submittedAt')}: {new Date(submission.createdAt).toLocaleString()}
            </DialogDescription>
          )}
        </DialogHeader>

        {submission !== null && (
          <div className="space-y-5">
            <section className="space-y-2">
              <h4 className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
                {t('detail.fields')}
              </h4>
              {entries.length === 0 ? (
                <EmptyState Icon={Inbox} size="sm" title={t('detail.empty')} />
              ) : (
                <dl className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                  {entries.map(([key, value]) => (
                    <div
                      key={key}
                      className="grid grid-cols-3 items-start gap-3 bg-card px-3 py-2.5 odd:bg-muted/30"
                    >
                      <dt className="truncate font-mono text-xs text-muted-foreground">{key}</dt>
                      <dd className="col-span-2 text-sm break-words whitespace-pre-wrap text-foreground">
                        {formatValue(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            <dl className="space-y-1.5 rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
              <div className="flex gap-2">
                <dt className="shrink-0 font-medium">{t('detail.ipAddress')}:</dt>
                <dd className="font-mono">{submission.ipAddress ?? '—'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0 font-medium">{t('detail.userAgent')}:</dt>
                <dd className="break-all">{submission.userAgent ?? '—'}</dd>
              </div>
            </dl>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                {t('detail.close')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onDelete(submission.id);
                }}
              >
                {t('detail.delete')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

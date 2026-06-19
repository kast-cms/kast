'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { FormSubmissionSummary } from '@kast-cms/sdk';
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
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('detail.title')}</DialogTitle>
          {submission !== null && (
            <DialogDescription>
              {t('detail.submittedAt')}: {new Date(submission.createdAt).toLocaleString()}
            </DialogDescription>
          )}
        </DialogHeader>
        {submission !== null && (
          <div className="space-y-4">
            <div>
              <h4 className="mb-2 text-sm font-medium">{t('detail.fields')}</h4>
              {entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('detail.empty')}</p>
              ) : (
                <dl className="divide-y divide-border rounded-md border">
                  {entries.map(([key, value]) => (
                    <div key={key} className="grid grid-cols-3 gap-2 p-3">
                      <dt className="text-sm font-medium text-muted-foreground">{key}</dt>
                      <dd className="col-span-2 text-sm break-words whitespace-pre-wrap">
                        {formatValue(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            <dl className="space-y-1 text-xs text-muted-foreground">
              <div className="flex gap-2">
                <dt className="font-medium">{t('detail.ipAddress')}:</dt>
                <dd>{submission.ipAddress ?? '—'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0 font-medium">{t('detail.userAgent')}:</dt>
                <dd className="break-all">{submission.userAgent ?? '—'}</dd>
              </div>
            </dl>
            <div className="flex justify-end gap-2">
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
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

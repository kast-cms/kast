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
import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';
import type { SeoWarning } from './seo-warnings';

interface SeoWarningDialogProps {
  open: boolean;
  warnings: SeoWarning[];
  isPublishing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The publish gate's escape hatch. The API refuses a warning-tier publish and
 * says "Pass force: true to override" — which was unreachable from this UI, so
 * an editor could read the instruction and had no way to act on it.
 *
 * ERROR-tier issues never get here: the API rejects those regardless of `force`,
 * and the editor surfaces that failure as an ordinary error.
 */
export function SeoWarningDialog({
  open,
  warnings,
  isPublishing,
  onConfirm,
  onCancel,
}: SeoWarningDialogProps): JSX.Element {
  const t = useTranslations('content.seoWarnings');

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-warning-subtle text-warning">
              <TriangleAlert className="size-4" />
            </span>
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('hint')}</DialogDescription>
        </DialogHeader>
        {warnings.length > 0 && (
          <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">
            {warnings.map((w) => (
              <li key={`${w.rule}:${w.message}`}>{w.message}</li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPublishing}>
            {t('cancel')}
          </Button>
          <Button onClick={onConfirm} loading={isPublishing}>
            {isPublishing ? t('publishing') : t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

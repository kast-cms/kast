'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';

interface ScheduleDialogProps {
  open: boolean;
  isSubmitting: boolean;
  onConfirm: (publishAt: string) => void;
  onCancel: () => void;
}

export function ScheduleDialog({
  open,
  isSubmitting,
  onConfirm,
  onCancel,
}: ScheduleDialogProps): JSX.Element {
  const t = useTranslations('content.schedule');
  const [value, setValue] = useState('');

  function handleConfirm(): void {
    if (value) onConfirm(new Date(value).toISOString());
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label htmlFor="schedule-publish-at">{t('publishAt')}</Label>
          <Input
            id="schedule-publish-at"
            type="datetime-local"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
            }}
            disabled={isSubmitting}
          />
          <p className="text-xs text-[--color-muted-foreground]">{t('hint')}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            {t('cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={!value || isSubmitting}>
            {isSubmitting ? t('scheduling') : t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

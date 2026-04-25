'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CreateRedirectBody, RedirectType } from '@kast/sdk';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';

interface CreateRedirectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (body: CreateRedirectBody) => Promise<void>;
}

const REDIRECT_TYPES: RedirectType[] = ['PERMANENT', 'TEMPORARY'];

export function CreateRedirectDialog({
  open,
  onOpenChange,
  onCreate,
}: CreateRedirectDialogProps): JSX.Element {
  const t = useTranslations('seo.redirects.create');
  const tTypes = useTranslations('seo.redirects.type');
  const [fromPath, setFromPath] = useState('');
  const [toPath, setToPath] = useState('');
  const [type, setType] = useState<RedirectType>('PERMANENT');
  const [submitting, setSubmitting] = useState(false);

  function handleOpenChange(next: boolean): void {
    if (!next) {
      setFromPath('');
      setToPath('');
      setType('PERMANENT');
    }
    onOpenChange(next);
  }

  function handleSubmit(): void {
    void (async (): Promise<void> => {
      if (!fromPath || !toPath) return;
      setSubmitting(true);
      try {
        await onCreate({ fromPath, toPath, type });
        handleOpenChange(false);
      } finally {
        setSubmitting(false);
      }
    })();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>{t('fromLabel')}</Label>
            <Input
              value={fromPath}
              onChange={(e) => setFromPath(e.target.value)}
              placeholder={t('fromPlaceholder')}
            />
          </div>
          <div className="space-y-1">
            <Label>{t('toLabel')}</Label>
            <Input
              value={toPath}
              onChange={(e) => setToPath(e.target.value)}
              placeholder={t('toPlaceholder')}
            />
          </div>
          <div className="space-y-1">
            <Label>{t('typeLabel')}</Label>
            <Select value={type} onValueChange={(v) => setType(v as RedirectType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REDIRECT_TYPES.map((rt) => (
                  <SelectItem key={rt} value={rt}>
                    {tTypes(rt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !fromPath || !toPath}>
              {submitting ? t('submitting') : t('submit')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

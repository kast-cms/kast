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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CreateRedirectBody, RedirectType } from '@kast-cms/sdk';
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
  const tCommon = useTranslations('common');
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
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="redirect-from" required>
              {t('fromLabel')}
            </Label>
            <Input
              id="redirect-from"
              value={fromPath}
              onChange={(e) => setFromPath(e.target.value)}
              placeholder={t('fromPlaceholder')}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="redirect-to" required>
              {t('toLabel')}
            </Label>
            <Input
              id="redirect-to"
              value={toPath}
              onChange={(e) => setToPath(e.target.value)}
              placeholder={t('toPlaceholder')}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="redirect-type">{t('typeLabel')}</Label>
            <Select value={type} onValueChange={(v) => setType(v as RedirectType)}>
              <SelectTrigger id="redirect-type">
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={!fromPath || !toPath}>
            {submitting ? t('submitting') : t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

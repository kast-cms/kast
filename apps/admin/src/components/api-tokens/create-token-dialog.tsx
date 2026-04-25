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
import type { CreateApiTokenBody, TokenScope } from '@kast/sdk';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (body: CreateApiTokenBody) => Promise<void>;
}

const SCOPES: TokenScope[] = ['READ_ONLY', 'FULL_ACCESS', 'SCOPED'];

export function CreateTokenDialog({ open, onOpenChange, onCreate }: Props): JSX.Element {
  const t = useTranslations('apiTokens.createDialog');
  const ts = useTranslations('apiTokens.scope');
  const [name, setName] = useState('');
  const [scope, setScope] = useState<TokenScope>('READ_ONLY');
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (): void => {
    void (async (): Promise<void> => {
      setSubmitting(true);
      try {
        const body: CreateApiTokenBody = {
          name,
          scope,
          ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
        };
        await onCreate(body);
        setName('');
        setScope('READ_ONLY');
        setExpiresAt('');
        onOpenChange(false);
      } finally {
        setSubmitting(false);
      }
    })();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="token-name">{t('name')}</Label>
            <Input
              id="token-name"
              placeholder={t('namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="token-scope">{t('scope')}</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as TokenScope)}>
              <SelectTrigger id="token-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {ts(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="token-expiry">{t('expiry')}</Label>
            <Input
              id="token-expiry"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <p className="text-xs text-[--color-muted-foreground]">{t('expiryHint')}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!name || submitting}>
            {submitting ? t('submitting') : t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

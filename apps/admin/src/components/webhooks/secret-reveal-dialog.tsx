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
import type { WebhookCreated } from '@kast/sdk';
import { Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';

interface Props {
  webhook: WebhookCreated | null;
  onClose: () => void;
}

export function SecretRevealDialog({ webhook, onClose }: Props): JSX.Element {
  const t = useTranslations('webhooks.secretReveal');
  const [copied, setCopied] = useState(false);

  if (!webhook) return <></>;

  const handleCopy = (): void => {
    void (async (): Promise<void> => {
      await navigator.clipboard.writeText(webhook.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    })();
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-[--color-muted-foreground]">{t('warning')}</p>
          <div className="flex items-center gap-2">
            <Input
              value={webhook.secret}
              readOnly
              className="font-mono text-xs"
              style={{ userSelect: 'all' }}
            />
            <Button variant="outline" size="icon" onClick={handleCopy}>
              <Copy className="h-4 w-4" />
            </Button>
            {copied && <span className="text-xs text-green-600">{t('copied')}</span>}
          </div>
          <p className="text-xs text-[--color-muted-foreground]">{t('hint')}</p>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>{t('done')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Hint } from '@/components/ui/tooltip';
import type { AgentTokenCreated } from '@kast-cms/sdk';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';

interface Props {
  token: AgentTokenCreated | null;
  onClose: () => void;
}

export function AgentTokenRevealDialog({ token, onClose }: Props): JSX.Element {
  const t = useTranslations('agentTokens.revealDialog');
  const [copied, setCopied] = useState(false);

  if (!token) return <></>;

  const handleCopy = (): void => {
    void (async (): Promise<void> => {
      await navigator.clipboard.writeText(token.token);
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* One-time secret: the warning has to carry real weight, so it is a
              proper alert rather than a line of muted helper text. */}
          <Alert variant="warning">
            <AlertDescription>{t('warning')}</AlertDescription>
          </Alert>

          {/* The token is shown in full and wraps rather than truncating — a
              half-copied credential is worse than no credential at all. */}
          <div className="relative rounded-lg border border-border bg-muted">
            <code className="block max-h-40 overflow-y-auto px-3.5 py-3 pe-12 font-mono text-xs leading-relaxed break-all text-foreground select-all">
              {token.token}
            </code>
            <Hint label="Copy">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Copy"
                className="absolute end-1.5 top-1.5"
                onClick={handleCopy}
              >
                {copied ? <Check className="text-success" /> : <Copy />}
              </Button>
            </Hint>
          </div>

          <p role="status" aria-live="polite" className="min-h-4 text-xs font-medium text-success">
            {copied ? t('copied') : null}
          </p>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>{t('done')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

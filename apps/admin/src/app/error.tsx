'use client';

import { Button } from '@/components/ui/button';
import { RotateCw, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps): JSX.Element {
  const t = useTranslations('error');

  return (
    <div className="surface-gradient grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-5 text-center">
        <div
          aria-hidden="true"
          className="grid size-14 place-items-center rounded-2xl bg-destructive-subtle text-destructive"
        >
          <TriangleAlert className="size-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
          <p className="text-sm text-balance text-muted-foreground">{t('description')}</p>
        </div>

        {error.digest !== undefined && error.digest !== '' && (
          <p className="rounded-md bg-muted px-2.5 py-1 font-mono text-2xs text-muted-foreground">
            {t('digest', { digest: error.digest })}
          </p>
        )}

        <Button onClick={reset} className="mt-1">
          <RotateCw />
          {t('retry')}
        </Button>
      </div>
    </div>
  );
}

'use client';
import type { JSX } from 'react';

import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps): JSX.Element {
  const t = useTranslations('error');

  return (
    <div className="grid min-h-screen place-items-center bg-[--color-background] p-4">
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-[--color-foreground]">{t('title')}</h1>
        <p className="text-[--color-muted-foreground]">{t('description')}</p>
        {error.digest && (
          <p className="text-xs text-[--color-muted-foreground]">
            {t('digest', { digest: error.digest })}
          </p>
        )}
        <Button onClick={reset}>{t('retry')}</Button>
      </div>
    </div>
  );
}

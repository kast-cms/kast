import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { JSX } from 'react';

export default function NotFound(): JSX.Element {
  const t = useTranslations('notFound');

  return (
    <div className="grid min-h-screen place-items-center bg-[--color-background] p-4">
      <div className="space-y-4 text-center">
        <p className="text-6xl font-bold text-[--color-primary]">404</p>
        <h1 className="text-2xl font-semibold text-[--color-foreground]">{t('title')}</h1>
        <p className="text-[--color-muted-foreground]">{t('description')}</p>
        <Link
          href="/content-types"
          className="inline-flex items-center gap-2 rounded-md bg-[--color-primary] px-4 py-2 text-sm font-medium text-[--color-primary-foreground] hover:opacity-90"
        >
          {t('backHome')}
        </Link>
      </div>
    </div>
  );
}

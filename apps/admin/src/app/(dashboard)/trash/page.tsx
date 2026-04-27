import { TrashTabs } from '@/components/trash/trash-tabs';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Trash' };

export default async function TrashPage(): Promise<JSX.Element> {
  const t = await getTranslations('trash');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('title')}</h2>
        <p className="text-[--color-muted-foreground]">{t('subtitle')}</p>
      </div>
      <TrashTabs />
    </div>
  );
}

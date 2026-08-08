import { TrashTabs } from '@/components/trash/trash-tabs';
import { PageHeader } from '@/components/ui/page-header';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Trash' };

export default async function TrashPage(): Promise<JSX.Element> {
  const t = await getTranslations('trash');

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('subtitle')} />
      <TrashTabs />
    </div>
  );
}

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DashboardQueueHealth } from '@kast-cms/sdk';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { JSX } from 'react';

interface QueueHealthTableProps {
  queues: DashboardQueueHealth[];
}

export function QueueHealthTable({ queues }: QueueHealthTableProps): JSX.Element {
  const t = useTranslations('dashboard.queueHealth');

  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm dark:bg-gray-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('title')}</h2>
        <Button asChild size="sm" variant="outline" className="text-xs">
          <Link href="/queues">{t('viewQueues')}</Link>
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-gray-400">
              <th className="pb-1 pr-3 font-medium">{t('queue')}</th>
              <th className="pb-1 pr-2 font-medium">{t('waiting')}</th>
              <th className="pb-1 pr-2 font-medium">{t('active')}</th>
              <th className="pb-1 pr-2 font-medium">{t('failed')}</th>
              <th className="pb-1 font-medium">{t('delayed')}</th>
            </tr>
          </thead>
          <tbody>
            {queues.map((q) => {
              const hasFailed = q.failed > 0;
              return (
                <tr
                  key={q.name}
                  className={`border-b last:border-0 ${hasFailed ? 'bg-red-50 dark:bg-red-950/30' : ''}`}
                >
                  <td className="py-1.5 pr-3 font-mono text-gray-700 dark:text-gray-200">
                    {q.name.replace('kast.', '')}
                    {hasFailed && (
                      <Badge variant="destructive" className="ml-1 py-0 text-[10px]">
                        {t('failedAlert')}
                      </Badge>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-gray-600 dark:text-gray-300">{q.waiting}</td>
                  <td className="py-1.5 pr-2 text-gray-600 dark:text-gray-300">{q.active}</td>
                  <td
                    className={`py-1.5 pr-2 ${hasFailed ? 'font-bold text-red-600' : 'text-gray-600 dark:text-gray-300'}`}
                  >
                    {q.failed}
                  </td>
                  <td className="py-1.5 text-gray-600 dark:text-gray-300">{q.delayed}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { DashboardQueueHealth } from '@kast-cms/sdk';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { JSX } from 'react';

interface QueueHealthTableProps {
  queues: DashboardQueueHealth[];
}

/** Pulls the first and last columns out to the card gutter (20px, not 16px). */
const EDGE_PADDING =
  '[&_td:first-child]:ps-5 [&_td:last-child]:pe-5 [&_th:first-child]:ps-5 [&_th:last-child]:pe-5';

export function QueueHealthTable({ queues }: QueueHealthTableProps): JSX.Element {
  const t = useTranslations('dashboard.queueHealth');

  const allHealthy = queues.every((q) => q.failed === 0);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-sm">{t('title')}</CardTitle>
        <CardAction>
          {allHealthy && (
            <Badge variant="success" dot>
              {t('healthy')}
            </Badge>
          )}
          <Button asChild size="xs" variant="outline">
            <Link href="/queues">{t('viewQueues')}</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        <Table className={EDGE_PADDING}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('queue')}</TableHead>
              <TableHead className="text-end">{t('waiting')}</TableHead>
              <TableHead className="text-end">{t('active')}</TableHead>
              <TableHead className="text-end">{t('failed')}</TableHead>
              <TableHead className="text-end">{t('delayed')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queues.map((q) => {
              const hasFailed = q.failed > 0;
              return (
                <TableRow
                  key={q.name}
                  className={cn(
                    hasFailed && 'bg-destructive-subtle/40 hover:bg-destructive-subtle/60',
                  )}
                >
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{q.name.replace('kast.', '')}</span>
                      {hasFailed && (
                        <Badge variant="destructive" size="sm">
                          {t('failedAlert')}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 text-end text-muted-foreground">
                    {q.waiting}
                  </TableCell>
                  <TableCell className="py-2.5 text-end text-muted-foreground">
                    {q.active}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'py-2.5 text-end',
                      hasFailed ? 'font-semibold text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {q.failed}
                  </TableCell>
                  <TableCell className="py-2.5 text-end text-muted-foreground">
                    {q.delayed}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

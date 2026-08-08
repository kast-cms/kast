'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Hint } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { WebhookDeliverySummary, WebhookSummary } from '@kast-cms/sdk';
import { Inbox, RotateCcw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type JSX } from 'react';

interface Props {
  endpoint: WebhookSummary;
  onClose: () => void;
  getDeliveries: (id: string) => Promise<WebhookDeliverySummary[]>;
  redeliver: (id: string, deliveryId: string) => Promise<void>;
}

function StatusBadge({ delivery }: { delivery: WebhookDeliverySummary }): JSX.Element {
  const t = useTranslations('webhooks.deliveries');
  if (delivery.succeededAt) {
    return (
      <Badge variant="success" dot>
        {t('success')}
      </Badge>
    );
  }
  if (delivery.failedAt) {
    return (
      <Badge variant="destructive" dot>
        {t('failed')}
      </Badge>
    );
  }
  return (
    <Badge variant="warning" dot>
      {t('pending')}
    </Badge>
  );
}

/** HTTP status is the one number an operator scans for, so it is colour-coded. */
function StatusCode({ code }: { code: number | null }): JSX.Element {
  if (code === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        'font-mono text-xs font-medium',
        code >= 200 && code < 300 ? 'text-success' : 'text-destructive',
      )}
    >
      {code}
    </span>
  );
}

function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString();
}

/** Placeholder rows so the table keeps its shape while deliveries load. */
function DeliveriesTableSkeleton(): JSX.Element {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <TableRow key={i} className="hover:bg-transparent">
          <TableCell>
            <Skeleton className="h-3.5 w-36" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4.5 w-20 rounded-md" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-8" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-6" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="ms-auto size-7 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function DeliveryLogPanel({
  endpoint,
  onClose,
  getDeliveries,
  redeliver,
}: Props): JSX.Element {
  const t = useTranslations('webhooks.deliveries');
  const [deliveries, setDeliveries] = useState<WebhookDeliverySummary[]>([]);
  const [loading, setLoading] = useState(false);

  const load = (): void => {
    void (async (): Promise<void> => {
      setLoading(true);
      try {
        const res = await getDeliveries(endpoint.id);
        setDeliveries(res);
      } finally {
        setLoading(false);
      }
    })();
  };

  useEffect(() => {
    load();
  }, [endpoint.id]);

  const handleRedeliver = (deliveryId: string): void => {
    void (async (): Promise<void> => {
      await redeliver(endpoint.id, deliveryId);
      load();
    })();
  };

  const isEmpty = deliveries.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{endpoint.name}</span>
            <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              {endpoint.url}
            </code>
          </span>
        }
        actions={
          <Hint label="Close">
            <Button variant="outline" size="icon-sm" aria-label="Close" onClick={onClose}>
              <X />
            </Button>
          </Hint>
        }
      />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('event')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead>{t('statusCode')}</TableHead>
              <TableHead className="text-end">{t('attempts')}</TableHead>
              <TableHead>{t('date')}</TableHead>
              <TableHead className="w-16 text-end">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isEmpty && loading && <DeliveriesTableSkeleton />}
            {isEmpty && !loading && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    Icon={Inbox}
                    size="sm"
                    title={t('empty')}
                    className="rounded-none border-0"
                  />
                </TableCell>
              </TableRow>
            )}
            {deliveries.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    {d.event}
                  </code>
                </TableCell>
                <TableCell>
                  <StatusBadge delivery={d} />
                </TableCell>
                <TableCell>
                  <StatusCode code={d.statusCode} />
                </TableCell>
                <TableCell className="text-end text-muted-foreground">{d.attempts}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(d.createdAt)}
                </TableCell>
                <TableCell className="text-end">
                  <Hint label={t('redeliver')}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('redeliver')}
                      onClick={() => handleRedeliver(d.id)}
                    >
                      <RotateCcw />
                    </Button>
                  </Hint>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

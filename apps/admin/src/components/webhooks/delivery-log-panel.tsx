'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { WebhookDeliverySummary, WebhookSummary } from '@kast/sdk';
import { RotateCcw, X } from 'lucide-react';
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
    return <Badge variant="default">{t('success')}</Badge>;
  }
  if (delivery.failedAt) {
    return (
      <Badge variant="outline" className="border-destructive text-destructive">
        {t('failed')}
      </Badge>
    );
  }
  return <Badge variant="secondary">{t('pending')}</Badge>;
}

function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString();
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="text-sm text-[--color-muted-foreground]">{endpoint.name}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('event')}</TableHead>
            <TableHead>{t('status')}</TableHead>
            <TableHead>{t('statusCode')}</TableHead>
            <TableHead>{t('attempts')}</TableHead>
            <TableHead>{t('date')}</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {deliveries.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-[--color-muted-foreground]">
                {loading ? '…' : t('empty')}
              </TableCell>
            </TableRow>
          )}
          {deliveries.map((d) => (
            <TableRow key={d.id}>
              <TableCell>
                <span className="font-mono text-xs">{d.event}</span>
              </TableCell>
              <TableCell>
                <StatusBadge delivery={d} />
              </TableCell>
              <TableCell>{d.statusCode ?? '—'}</TableCell>
              <TableCell>{d.attempts}</TableCell>
              <TableCell>{formatDate(d.createdAt)}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  title={t('redeliver')}
                  onClick={() => handleRedeliver(d.id)}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

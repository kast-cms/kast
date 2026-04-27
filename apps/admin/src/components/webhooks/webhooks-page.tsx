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
import type { WebhookSummary } from '@kast-cms/sdk';
import { FlaskConical, List, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';
import { CreateWebhookDrawer } from './create-webhook-drawer';
import { DeliveryLogPanel } from './delivery-log-panel';
import { SecretRevealDialog } from './secret-reveal-dialog';
import { useWebhooks } from './use-webhooks';

function ActiveBadge({ isActive }: { isActive: boolean }): JSX.Element {
  const t = useTranslations('webhooks');
  return (
    <Badge
      variant={isActive ? 'default' : 'outline'}
      className={isActive ? '' : 'text-[--color-muted-foreground]'}
    >
      {isActive ? t('active') : t('inactive')}
    </Badge>
  );
}

export function WebhooksPageClient(): JSX.Element {
  const t = useTranslations('webhooks');
  const lib = useWebhooks();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<WebhookSummary | null>(null);

  const handleDelete = (webhook: WebhookSummary): void => {
    if (!window.confirm(t('deleteConfirm', { name: webhook.name }))) return;
    void lib.remove(webhook.id);
  };

  const handleTest = (webhook: WebhookSummary): void => {
    void lib.test(webhook.id);
  };

  if (selectedEndpoint) {
    return (
      <div className="space-y-6">
        <DeliveryLogPanel
          endpoint={selectedEndpoint}
          onClose={() => setSelectedEndpoint(null)}
          getDeliveries={lib.getDeliveries}
          redeliver={lib.redeliver}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="mt-1 text-sm text-[--color-muted-foreground]">{t('description')}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="me-2 h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table.name')}</TableHead>
            <TableHead>{t('table.url')}</TableHead>
            <TableHead>{t('table.events')}</TableHead>
            <TableHead>{t('table.status')}</TableHead>
            <TableHead className="w-32" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lib.webhooks.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-[--color-muted-foreground]">
                {lib.loading ? '…' : t('noWebhooks')}
              </TableCell>
            </TableRow>
          )}
          {lib.webhooks.map((wh) => (
            <TableRow key={wh.id}>
              <TableCell className="font-medium">{wh.name}</TableCell>
              <TableCell>
                <span className="font-mono text-xs truncate max-w-[200px] block">{wh.url}</span>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{wh.events.length}</Badge>
              </TableCell>
              <TableCell>
                <ActiveBadge isActive={wh.isActive} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title={t('viewDeliveries')}
                    onClick={() => setSelectedEndpoint(wh)}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title={t('sendTest')}
                    onClick={() => handleTest(wh)}
                  >
                    <FlaskConical className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    title={t('delete')}
                    onClick={() => handleDelete(wh)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CreateWebhookDrawer open={showCreate} onOpenChange={setShowCreate} onCreate={lib.create} />

      <SecretRevealDialog webhook={lib.createdWebhook} onClose={lib.clearCreatedWebhook} />
    </div>
  );
}

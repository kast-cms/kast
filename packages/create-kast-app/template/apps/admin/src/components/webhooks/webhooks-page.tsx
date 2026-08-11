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
import type { WebhookSummary } from '@kast-cms/sdk';
import { FlaskConical, List, Plus, Trash2, Webhook } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';
import { CreateWebhookDrawer } from './create-webhook-drawer';
import { DeliveryLogPanel } from './delivery-log-panel';
import { SecretRevealDialog } from './secret-reveal-dialog';
import { useWebhooks } from './use-webhooks';

function ActiveBadge({ isActive }: { isActive: boolean }): JSX.Element {
  const t = useTranslations('webhooks');
  return (
    <Badge variant={isActive ? 'success' : 'muted'} dot>
      {isActive ? t('active') : t('inactive')}
    </Badge>
  );
}

/** Placeholder rows so the table keeps its shape while the first load runs. */
function WebhooksTableSkeleton(): JSX.Element {
  return (
    <>
      {Array.from({ length: 4 }, (_, i) => (
        <TableRow key={i} className="hover:bg-transparent">
          <TableCell>
            <Skeleton className="h-3.5 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4.5 w-48 rounded-sm" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4.5 w-8 rounded-md" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4.5 w-16 rounded-md" />
          </TableCell>
          <TableCell>
            <Skeleton className="ms-auto h-7 w-24 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
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
      <DeliveryLogPanel
        endpoint={selectedEndpoint}
        onClose={() => setSelectedEndpoint(null)}
        getDeliveries={lib.getDeliveries}
        redeliver={lib.redeliver}
      />
    );
  }

  const isEmpty = lib.webhooks.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus />
            {t('create')}
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('table.name')}</TableHead>
              <TableHead>{t('table.url')}</TableHead>
              <TableHead className="text-end">{t('table.events')}</TableHead>
              <TableHead>{t('table.status')}</TableHead>
              <TableHead className="w-32 text-end">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isEmpty && lib.loading && <WebhooksTableSkeleton />}
            {isEmpty && !lib.loading && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="p-0">
                  <EmptyState
                    Icon={Webhook}
                    size="sm"
                    title={t('noWebhooks')}
                    description={t('description')}
                    className="rounded-none border-0"
                    action={
                      <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
                        <Plus />
                        {t('create')}
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            )}
            {lib.webhooks.map((wh) => (
              <TableRow key={wh.id}>
                <TableCell className="font-medium text-foreground">{wh.name}</TableCell>
                <TableCell>
                  <code className="block max-w-[22rem] truncate rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    {wh.url}
                  </code>
                </TableCell>
                <TableCell className="text-end">
                  <Badge variant="muted">{wh.events.length}</Badge>
                </TableCell>
                <TableCell>
                  <ActiveBadge isActive={wh.isActive} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Hint label={t('viewDeliveries')}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('viewDeliveries')}
                        onClick={() => setSelectedEndpoint(wh)}
                      >
                        <List />
                      </Button>
                    </Hint>
                    <Hint label={t('sendTest')}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('sendTest')}
                        onClick={() => handleTest(wh)}
                      >
                        <FlaskConical />
                      </Button>
                    </Hint>
                    <Hint label={t('delete')}>
                      <Button
                        variant="ghost-destructive"
                        size="icon-sm"
                        aria-label={t('delete')}
                        onClick={() => handleDelete(wh)}
                      >
                        <Trash2 />
                      </Button>
                    </Hint>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <CreateWebhookDrawer open={showCreate} onOpenChange={setShowCreate} onCreate={lib.create} />

      <SecretRevealDialog webhook={lib.createdWebhook} onClose={lib.clearCreatedWebhook} />
    </div>
  );
}

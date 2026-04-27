'use client';

import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type {
  CreateWebhookBody,
  UpdateWebhookBody,
  WebhookCreated,
  WebhookDeliverySummary,
  WebhookSummary,
} from '@kast-cms/sdk';
import { useCallback, useEffect, useState } from 'react';

export interface UseWebhooksReturn {
  webhooks: WebhookSummary[];
  loading: boolean;
  createdWebhook: WebhookCreated | null;
  create: (body: CreateWebhookBody) => Promise<void>;
  update: (id: string, body: UpdateWebhookBody) => Promise<void>;
  remove: (id: string) => Promise<void>;
  test: (id: string) => Promise<void>;
  clearCreatedWebhook: () => void;
  getDeliveries: (id: string) => Promise<WebhookDeliverySummary[]>;
  redeliver: (id: string, deliveryId: string) => Promise<void>;
}

export function useWebhooks(): UseWebhooksReturn {
  const { session } = useSession();
  const client = createApiClient(session?.accessToken);

  const [webhooks, setWebhooks] = useState<WebhookSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [createdWebhook, setCreatedWebhook] = useState<WebhookCreated | null>(null);

  const loadWebhooks = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await client.webhooks.list();
      setWebhooks(res as WebhookSummary[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWebhooks();
  }, [loadWebhooks]);

  const create = useCallback(
    async (body: CreateWebhookBody): Promise<void> => {
      const res = await client.webhooks.create(body);
      setCreatedWebhook(res as WebhookCreated);
      void loadWebhooks();
    },
    [loadWebhooks],
  );

  const update = useCallback(
    async (id: string, body: UpdateWebhookBody): Promise<void> => {
      await client.webhooks.update(id, body);
      void loadWebhooks();
    },
    [loadWebhooks],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await client.webhooks.delete(id);
      void loadWebhooks();
    },
    [loadWebhooks],
  );

  const test = useCallback(async (id: string): Promise<void> => {
    await client.webhooks.test(id);
  }, []);

  const clearCreatedWebhook = useCallback((): void => {
    setCreatedWebhook(null);
  }, []);

  const getDeliveries = useCallback(async (id: string): Promise<WebhookDeliverySummary[]> => {
    const res = await client.webhooks.deliveries(id);
    return res as WebhookDeliverySummary[];
  }, []);

  const redeliver = useCallback(async (id: string, deliveryId: string): Promise<void> => {
    await client.webhooks.redeliver(id, deliveryId);
  }, []);

  return {
    webhooks,
    loading,
    createdWebhook,
    create,
    update,
    remove,
    test,
    clearCreatedWebhook,
    getDeliveries,
    redeliver,
  };
}

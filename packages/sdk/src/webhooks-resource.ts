import type { KastClient } from './client.js';

export interface WebhookSummary {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookCreated extends WebhookSummary {
  /** Raw HMAC secret — shown once at creation, never returned again. */
  secret: string;
}

export interface WebhookDeliverySummary {
  id: string;
  endpointId: string;
  event: string;
  payload: unknown;
  statusCode: number | null;
  responseBody: string | null;
  attempts: number;
  nextRetryAt: string | null;
  succeededAt: string | null;
  failedAt: string | null;
  createdAt: string;
}

export interface CreateWebhookBody {
  name: string;
  url: string;
  events: string[];
}

export interface UpdateWebhookBody {
  name?: string;
  url?: string;
  events?: string[];
  isActive?: boolean;
}

export class WebhooksResource {
  constructor(private readonly client: KastClient) {}

  list(): Promise<WebhookSummary[]> {
    return this.client.request('/api/v1/webhooks');
  }

  create(data: CreateWebhookBody): Promise<WebhookCreated> {
    return this.client.request('/api/v1/webhooks', { method: 'POST', body: data });
  }

  findOne(id: string): Promise<WebhookSummary> {
    return this.client.request(`/api/v1/webhooks/${id}`);
  }

  update(id: string, data: UpdateWebhookBody): Promise<WebhookSummary> {
    return this.client.request(`/api/v1/webhooks/${id}`, { method: 'PATCH', body: data });
  }

  delete(id: string): Promise<void> {
    return this.client.request(`/api/v1/webhooks/${id}`, { method: 'DELETE' });
  }

  test(id: string): Promise<void> {
    return this.client.request(`/api/v1/webhooks/${id}/test`, { method: 'POST' });
  }

  deliveries(id: string): Promise<WebhookDeliverySummary[]> {
    return this.client.request(`/api/v1/webhooks/${id}/deliveries`);
  }

  redeliver(id: string, deliveryId: string): Promise<void> {
    return this.client.request(`/api/v1/webhooks/${id}/deliveries/${deliveryId}/redeliver`, {
      method: 'POST',
    });
  }

  /** @alias findOne */
  get(id: string): Promise<WebhookSummary> {
    return this.findOne(id);
  }

  /** @alias deliveries */
  getDeliveries(id: string): Promise<WebhookDeliverySummary[]> {
    return this.deliveries(id);
  }
}

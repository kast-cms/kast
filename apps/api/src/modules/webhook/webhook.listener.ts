import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { QueueAdapter } from '../queue/queue.adapter';
import { QUEUE_NAMES } from '../queue/queue.constants';
import type { WebhookEventPayload } from './webhook.events';
import type { WebhookFireJobData } from './webhook.processor';
import { WebhookRepository } from './webhook.repository';

const FIRE_OPTS = { attempts: 5, backoff: { type: 'exponential' as const, delay: 1000 } };

@Injectable()
export class WebhookListener {
  constructor(
    private readonly repo: WebhookRepository,
    private readonly queue: QueueAdapter,
  ) {}

  @OnEvent('content.created')
  async onContentCreated(payload: WebhookEventPayload): Promise<void> {
    await this.dispatch('content.created', payload);
  }

  @OnEvent('content.updated')
  async onContentUpdated(payload: WebhookEventPayload): Promise<void> {
    await this.dispatch('content.updated', payload);
  }

  @OnEvent('content.published')
  async onContentPublished(payload: WebhookEventPayload): Promise<void> {
    await this.dispatch('content.published', payload);
  }

  @OnEvent('content.unpublished')
  async onContentUnpublished(payload: WebhookEventPayload): Promise<void> {
    await this.dispatch('content.unpublished', payload);
  }

  @OnEvent('content.trashed')
  async onContentTrashed(payload: WebhookEventPayload): Promise<void> {
    await this.dispatch('content.trashed', payload);
  }

  @OnEvent('media.uploaded')
  async onMediaUploaded(payload: WebhookEventPayload): Promise<void> {
    await this.dispatch('media.uploaded', payload);
  }

  @OnEvent('user.created')
  async onUserCreated(payload: WebhookEventPayload): Promise<void> {
    await this.dispatch('user.created', payload);
  }

  private async dispatch(event: string, payload: WebhookEventPayload): Promise<void> {
    const endpoints = await this.repo.findActiveByEvent(event);
    await Promise.all(
      endpoints.map(async (ep) => {
        const delivery = await this.repo.createDelivery({
          endpointId: ep.id,
          event,
          payload: payload as Record<string, unknown>,
        });
        const jobData: WebhookFireJobData = { endpointId: ep.id, deliveryId: delivery.id };
        await this.queue.enqueue(QUEUE_NAMES.WEBHOOK, 'fire', jobData, FIRE_OPTS);
      }),
    );
  }
}

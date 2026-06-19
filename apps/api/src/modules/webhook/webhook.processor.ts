import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { createHmac } from 'crypto';
import { decryptSecret } from '../../common/utils/secret-crypto.util';
import type { Env } from '../../config/env.schema';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { WebhookRepository } from './webhook.repository';

export interface WebhookFireJobData {
  endpointId: string;
  deliveryId: string;
}

interface DeliveryPayload {
  id: string;
  event: string;
  timestamp: string;
  data: unknown;
}

@Processor(QUEUE_NAMES.WEBHOOK, { concurrency: 10 })
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);
  private readonly appSecret: string;

  constructor(
    private readonly repo: WebhookRepository,
    config: ConfigService<Env>,
  ) {
    super();
    this.appSecret = config.get('JWT_SECRET', { infer: true }) ?? 'kast-dev-secret';
  }

  async process(job: Job<WebhookFireJobData>): Promise<void> {
    if (job.name === 'fire') {
      await this.fire(job.data);
    } else {
      this.logger.warn(`Unknown webhook job: ${String(job.name)}`);
    }
  }

  private async fire(data: WebhookFireJobData): Promise<void> {
    const { endpointId, deliveryId } = data;

    const endpoint = await this.repo.findByIdWithSecret(endpointId);
    if (!endpoint) {
      this.logger.warn(`Endpoint ${endpointId} not found, skipping delivery ${deliveryId}`);
      return;
    }

    const delivery = await this.repo.findDelivery(deliveryId);
    if (!delivery) {
      this.logger.warn(`Delivery ${deliveryId} not found`);
      return;
    }

    const payload: DeliveryPayload = {
      id: delivery.id,
      event: delivery.event,
      timestamp: delivery.createdAt.toISOString(),
      data: delivery.payload,
    };

    const body = JSON.stringify(payload);
    // Sign with the real plaintext secret (decrypted from storage) so receivers
    // can verify the signature with the secret they were shown at creation.
    const signingKey = decryptSecret(endpoint.secretHash, this.appSecret);
    const sig = createHmac('sha256', signingKey).update(body).digest('hex');

    const attempts = delivery.attempts + 1;
    let statusCode: number | undefined;
    let responseBody = '';
    let succeeded = false;

    try {
      const result = await this.post(endpoint.url, sig, delivery.event, delivery.id, body);
      statusCode = result.statusCode;
      responseBody = result.responseBody;
      succeeded = result.ok;
    } catch (err) {
      this.logger.warn(`Delivery ${deliveryId} failed: ${String(err)}`);
      responseBody = String(err);
    }

    await this.repo.updateDelivery(deliveryId, {
      ...(statusCode !== undefined ? { statusCode } : {}),
      responseBody,
      attempts,
      succeededAt: succeeded ? new Date() : null,
      failedAt: !succeeded ? new Date() : null,
    });

    if (!succeeded) {
      throw new Error(
        `Webhook delivery ${deliveryId} failed with status ${statusCode?.toString() ?? 'N/A'}`,
      );
    }
  }

  private async post(
    url: string,
    sig: string,
    event: string,
    deliveryId: string,
    body: string,
  ): Promise<{ statusCode: number; responseBody: string; ok: boolean }> {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Kast-Signature': `sha256=${sig}`,
        'X-Kast-Event': event,
        'X-Kast-Delivery': deliveryId,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    return { statusCode: res.status, responseBody: await res.text().catch(() => ''), ok: res.ok };
  }
}

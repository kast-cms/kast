import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { UnrecoverableError, type Job } from 'bullmq';
import { createHmac } from 'crypto';
import { SecretEncryptionService } from '../../common/security/secret-encryption.service';
import {
  BlockedUrlError,
  fetchGuarded,
  parseHostAllowList,
  type BlockedUrlReason,
} from '../../common/utils/ssrf-guard.util';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { WebhookRepository } from './webhook.repository';

export interface WebhookFireJobData {
  endpointId: string;
  deliveryId: string;
}

interface DeliveryPayload {
  version: '1';
  id: string;
  event: string;
  timestamp: string;
  data: unknown;
}

interface DeliveryOutcome {
  statusCode?: number;
  responseBody: string;
  succeeded: boolean;
  blockedReason?: BlockedUrlReason;
}

// WebhookDelivery.responseBody is unbounded text; a hostile or merely chatty
// receiver must not be able to stream megabytes per attempt into the database.
const MAX_RESPONSE_BODY_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
// A refused redirect target goes into the operator-facing delivery row, so it is
// bounded independently of the response body it replaces.
const MAX_BLOCKED_TARGET_CHARS = 200;

// A refusal to send is permanent — whether the target was configured or named by
// the receiver in a `Location` header, retrying only re-runs the same verdict and
// re-probes the same address. Only these two survive a retry: a resolver outage and
// a receiver's redirect loop are conditions around the target rather than verdicts
// about it, and deliveries kept their full backoff budget for both before the
// egress policy existed.
const RETRYABLE_BLOCK_REASONS: ReadonlySet<BlockedUrlReason> = new Set<BlockedUrlReason>([
  'dns_failure',
  'too_many_redirects',
]);

function clamp(text: string): string {
  const buf = Buffer.from(text, 'utf8');
  if (buf.byteLength <= MAX_RESPONSE_BODY_BYTES) return text;
  return `${buf.subarray(0, MAX_RESPONSE_BODY_BYTES).toString('utf8')}\n[truncated]`;
}

/**
 * The line an operator reads off the delivery row. A redirect refusal names the
 * target the receiver sent so it cannot be confused with a misconfigured endpoint
 * URL, nor with the receiver simply being down.
 */
function describeBlock(err: BlockedUrlError): string {
  const target = err.redirectTarget;
  if (target === undefined) return `blocked by egress policy: ${err.reason}`;
  const shown =
    target.length > MAX_BLOCKED_TARGET_CHARS
      ? `${target.slice(0, MAX_BLOCKED_TARGET_CHARS)}...`
      : target;
  return `blocked by egress policy: endpoint redirected to ${shown}, which was not followed (${err.reason})`;
}

@Processor(QUEUE_NAMES.WEBHOOK, { concurrency: 10 })
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    private readonly repo: WebhookRepository,
    private readonly secrets: SecretEncryptionService,
  ) {
    super();
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
      version: '1',
      id: delivery.id,
      event: delivery.event,
      timestamp: delivery.createdAt.toISOString(),
      data: delivery.payload,
    };

    const body = JSON.stringify(payload);
    // Sign with the real plaintext secret (decrypted from storage) so receivers
    // can verify the signature with the secret they were shown at creation.
    const decrypted = this.secrets.decryptAndRotate(endpoint.secretHash);
    const signingKey = decrypted.plaintext;
    if (decrypted.rotatedCiphertext) {
      await this.repo.rotateSecret(endpoint.id, decrypted.rotatedCiphertext);
    }
    const sig = createHmac('sha256', signingKey).update(body).digest('hex');

    const outcome = await this.attempt(endpoint.url, sig, delivery.event, delivery.id, body);

    await this.repo.updateDelivery(deliveryId, {
      ...(outcome.statusCode !== undefined ? { statusCode: outcome.statusCode } : {}),
      responseBody: outcome.responseBody,
      attempts: delivery.attempts + 1,
      succeededAt: outcome.succeeded ? new Date() : null,
      failedAt: outcome.succeeded ? null : new Date(),
    });

    this.raiseIfUnsuccessful(deliveryId, outcome);
  }

  /**
   * Translates a recorded outcome into the throw bullmq needs to schedule (or
   * refuse) a retry. Kept separate from `fire` so the delivery row is always
   * written before any of these branches can run.
   */
  private raiseIfUnsuccessful(deliveryId: string, outcome: DeliveryOutcome): void {
    const { blockedReason } = outcome;
    if (blockedReason !== undefined) {
      if (RETRYABLE_BLOCK_REASONS.has(blockedReason)) {
        throw new Error(`Webhook delivery ${deliveryId} could not be sent: ${blockedReason}`);
      }
      // The same message the delivery row carries, so the queue's failed-job log and
      // the delivery history read alike.
      throw new UnrecoverableError(`Webhook delivery ${deliveryId} ${outcome.responseBody}`);
    }
    if (!outcome.succeeded) {
      const status = outcome.statusCode?.toString() ?? 'N/A';
      throw new Error(`Webhook delivery ${deliveryId} failed with status ${status}`);
    }
  }

  private async attempt(
    url: string,
    sig: string,
    event: string,
    deliveryId: string,
    body: string,
  ): Promise<DeliveryOutcome> {
    try {
      const res = await this.post(url, sig, event, deliveryId, body);
      return {
        statusCode: res.status,
        responseBody: res.truncated ? `${res.body}\n[truncated]` : res.body,
        succeeded: res.ok,
      };
    } catch (err) {
      this.logger.warn(`Delivery ${deliveryId} failed: ${String(err)}`);
      if (err instanceof BlockedUrlError) {
        return {
          responseBody: describeBlock(err),
          succeeded: false,
          blockedReason: err.reason,
        };
      }
      return { responseBody: clamp(String(err)), succeeded: false };
    }
  }

  private post(
    url: string,
    sig: string,
    event: string,
    deliveryId: string,
    body: string,
  ): Promise<{ status: number; body: string; truncated: boolean; ok: boolean }> {
    return fetchGuarded(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kast-Signature': `sha256=${sig}`,
          'X-Kast-Event': event,
          'X-Kast-Delivery': deliveryId,
          'Idempotency-Key': deliveryId,
          'X-Kast-Version': '1',
        },
        body,
      },
      {
        allowList: parseHostAllowList(process.env.WEBHOOK_ALLOWED_HOSTS),
        maxBytes: MAX_RESPONSE_BODY_BYTES,
        maxRedirects: MAX_REDIRECTS,
        timeoutMs: REQUEST_TIMEOUT_MS,
      },
    );
  }
}

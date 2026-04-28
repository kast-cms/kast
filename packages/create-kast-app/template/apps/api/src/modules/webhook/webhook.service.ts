import { Injectable, NotFoundException } from '@nestjs/common';
import type { WebhookDelivery } from '@prisma/client';
import { randomBytes } from 'crypto';
import { QueueAdapter } from '../queue/queue.adapter';
import { QUEUE_NAMES } from '../queue/queue.constants';
import type { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';
import type { WebhookFireJobData } from './webhook.processor';
import { WebhookRepository, type EndpointRow } from './webhook.repository';

export interface WebhookCreatedResult extends EndpointRow {
  secret: string;
}

const FIRE_OPTS = { attempts: 5, backoff: { type: 'exponential' as const, delay: 1000 } };

@Injectable()
export class WebhookService {
  constructor(
    private readonly repo: WebhookRepository,
    private readonly queue: QueueAdapter,
  ) {}

  list(): Promise<EndpointRow[]> {
    return this.repo.findAll();
  }

  async create(dto: CreateWebhookDto): Promise<WebhookCreatedResult> {
    const secret = randomBytes(32).toString('hex');
    const endpoint = await this.repo.create({
      name: dto.name,
      url: dto.url,
      secretHash: secret,
      events: dto.events,
    });
    const { secretHash: _omitted, ...rest } = endpoint;
    return { ...rest, secret };
  }

  async findOne(id: string): Promise<EndpointRow> {
    const endpoint = await this.repo.findById(id);
    if (!endpoint) throw new NotFoundException(`Webhook endpoint ${id} not found`);
    return endpoint;
  }

  async update(id: string, dto: UpdateWebhookDto): Promise<EndpointRow> {
    await this.findOne(id);
    return this.repo.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }

  async test(id: string): Promise<void> {
    const endpoint = await this.findOne(id);
    const delivery = await this.repo.createDelivery({
      endpointId: endpoint.id,
      event: 'webhook.test',
      payload: { message: 'This is a test delivery from Kast.' },
    });
    const jobData: WebhookFireJobData = { endpointId: endpoint.id, deliveryId: delivery.id };
    await this.queue.enqueue(QUEUE_NAMES.WEBHOOK, 'fire', jobData, FIRE_OPTS);
  }

  async getDeliveries(id: string): Promise<WebhookDelivery[]> {
    await this.findOne(id);
    return this.repo.findDeliveries(id);
  }

  async redeliver(id: string, deliveryId: string): Promise<void> {
    await this.findOne(id);
    const delivery = await this.repo.findDelivery(deliveryId);
    if (delivery?.endpointId !== id) {
      throw new NotFoundException(`Delivery ${deliveryId} not found for endpoint ${id}`);
    }
    const jobData: WebhookFireJobData = { endpointId: id, deliveryId };
    await this.queue.enqueue(QUEUE_NAMES.WEBHOOK, 'fire', jobData, FIRE_OPTS);
  }
}

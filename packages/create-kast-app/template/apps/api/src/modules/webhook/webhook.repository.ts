import { Injectable } from '@nestjs/common';
import { Prisma, type WebhookDelivery, type WebhookEndpoint } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type EndpointRow = Omit<WebhookEndpoint, 'secretHash'>;
export type EndpointWithSecret = WebhookEndpoint;

type CreateDeliveryData = {
  endpointId: string;
  event: string;
  payload: Record<string, unknown>;
};

type UpdateDeliveryData = Prisma.WebhookDeliveryUpdateInput;

const ENDPOINT_SELECT = {
  id: true,
  name: true,
  url: true,
  isActive: true,
  events: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class WebhookRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    name: string;
    url: string;
    secretHash: string;
    events: string[];
  }): Promise<EndpointWithSecret> {
    return this.prisma.webhookEndpoint.create({ data });
  }

  findAll(): Promise<EndpointRow[]> {
    return this.prisma.webhookEndpoint.findMany({
      select: ENDPOINT_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string): Promise<EndpointRow | null> {
    return this.prisma.webhookEndpoint.findUnique({
      where: { id },
      select: ENDPOINT_SELECT,
    });
  }

  findByIdWithSecret(id: string): Promise<EndpointWithSecret | null> {
    return this.prisma.webhookEndpoint.findUnique({ where: { id } });
  }

  findActiveByEvent(event: string): Promise<EndpointRow[]> {
    return this.prisma.webhookEndpoint.findMany({
      where: { isActive: true, events: { has: event } },
      select: ENDPOINT_SELECT,
    });
  }

  update(
    id: string,
    data: { name?: string; url?: string; events?: string[]; isActive?: boolean },
  ): Promise<EndpointRow> {
    return this.prisma.webhookEndpoint.update({
      where: { id },
      data,
      select: ENDPOINT_SELECT,
    });
  }

  delete(id: string): Promise<EndpointRow> {
    return this.prisma.webhookEndpoint.delete({ where: { id }, select: ENDPOINT_SELECT });
  }

  createDelivery(data: CreateDeliveryData): Promise<WebhookDelivery> {
    return this.prisma.webhookDelivery.create({
      data: { ...data, payload: data.payload as Prisma.InputJsonValue },
    });
  }

  updateDelivery(id: string, data: UpdateDeliveryData): Promise<WebhookDelivery> {
    return this.prisma.webhookDelivery.update({ where: { id }, data });
  }

  findDelivery(id: string): Promise<WebhookDelivery | null> {
    return this.prisma.webhookDelivery.findUnique({ where: { id } });
  }

  findDeliveries(endpointId: string, limit = 100): Promise<WebhookDelivery[]> {
    return this.prisma.webhookDelivery.findMany({
      where: { endpointId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

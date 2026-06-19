import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { decryptSecret } from '../../common/utils/secret-crypto.util';
import type { QueueAdapter } from '../queue/queue.adapter';
import { QUEUE_NAMES } from '../queue/queue.constants';
import type { EndpointRow, EndpointWithSecret, WebhookRepository } from './webhook.repository';
import { WebhookService } from './webhook.service';

type Mocked<T> = { [K in keyof T]: jest.Mock };

const APP_SECRET = 'unit-test-app-secret-0123456789';

function buildEndpoint(over: Partial<EndpointWithSecret> = {}): EndpointWithSecret {
  return {
    id: 'wh1',
    name: 'My Hook',
    url: 'https://example.com/hook',
    secretHash: 'enc:v1:placeholder',
    events: ['content.published'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as EndpointWithSecret;
}

describe('WebhookService', () => {
  let repo: Mocked<WebhookRepository>;
  let queue: Mocked<QueueAdapter>;
  let service: WebhookService;

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByIdWithSecret: jest.fn(),
      findActiveByEvent: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createDelivery: jest.fn(),
      updateDelivery: jest.fn(),
      findDelivery: jest.fn(),
      findDeliveries: jest.fn(),
    } as unknown as Mocked<WebhookRepository>;
    queue = { enqueue: jest.fn().mockResolvedValue(undefined) } as unknown as Mocked<QueueAdapter>;
    const config = { get: jest.fn().mockReturnValue(APP_SECRET) } as unknown as ConfigService;
    service = new WebhookService(
      repo as unknown as WebhookRepository,
      queue as unknown as QueueAdapter,
      config,
    );
  });

  describe('create', () => {
    it('encrypts a caller-supplied secret at rest and returns the plaintext exactly once', async () => {
      let storedHash = '';
      repo.create.mockImplementation((data: { secretHash: string }) => {
        storedHash = data.secretHash;
        return Promise.resolve(buildEndpoint({ secretHash: data.secretHash }));
      });

      const result = await service.create({
        name: 'My Hook',
        url: 'https://example.com/hook',
        events: ['content.published'],
        secret: 'whsec_supplied_secret',
      });

      // Returned to caller in plaintext, once.
      expect(result.secret).toBe('whsec_supplied_secret');
      // Stored encrypted (not plaintext) and round-trips back to the original.
      expect(storedHash.startsWith('enc:v1:')).toBe(true);
      expect(storedHash).not.toContain('whsec_supplied_secret');
      expect(decryptSecret(storedHash, APP_SECRET)).toBe('whsec_supplied_secret');
      // secretHash is never returned to the API consumer.
      expect(result as unknown as Record<string, unknown>).not.toHaveProperty('secretHash');
    });

    it('generates a random secret when none is supplied', async () => {
      let storedHash = '';
      repo.create.mockImplementation((data: { secretHash: string }) => {
        storedHash = data.secretHash;
        return Promise.resolve(buildEndpoint({ secretHash: data.secretHash }));
      });

      const result = await service.create({
        name: 'Auto',
        url: 'https://example.com/auto',
        events: ['content.published'],
      });

      expect(result.secret).toMatch(/^[0-9a-f]{64}$/); // 32 random bytes hex
      expect(decryptSecret(storedHash, APP_SECRET)).toBe(result.secret);
    });
  });

  describe('findOne', () => {
    it('throws NotFound for an unknown endpoint', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('re-encrypts a rotated secret and leaves other fields intact', async () => {
      repo.findById.mockResolvedValue(buildEndpoint() as EndpointRow);
      let updateData: Record<string, unknown> = {};
      repo.update.mockImplementation((_id: string, data: Record<string, unknown>) => {
        updateData = data;
        return Promise.resolve(buildEndpoint() as EndpointRow);
      });

      await service.update('wh1', { name: 'Renamed', secret: 'whsec_rotated' });

      expect(updateData.name).toBe('Renamed');
      expect(updateData).not.toHaveProperty('secret');
      expect(typeof updateData.secretHash).toBe('string');
      expect(decryptSecret(updateData.secretHash as string, APP_SECRET)).toBe('whsec_rotated');
    });

    it('does not set secretHash when no secret is provided', async () => {
      repo.findById.mockResolvedValue(buildEndpoint() as EndpointRow);
      let updateData: Record<string, unknown> = {};
      repo.update.mockImplementation((_id: string, data: Record<string, unknown>) => {
        updateData = data;
        return Promise.resolve(buildEndpoint() as EndpointRow);
      });
      await service.update('wh1', { isActive: false });
      expect(updateData).not.toHaveProperty('secretHash');
      expect(updateData.isActive).toBe(false);
    });
  });

  describe('test / redeliver', () => {
    it('creates a test delivery and enqueues a fire job', async () => {
      repo.findById.mockResolvedValue(buildEndpoint() as EndpointRow);
      repo.createDelivery.mockResolvedValue({ id: 'del1' });
      await service.test('wh1');
      expect(queue.enqueue).toHaveBeenCalledWith(
        QUEUE_NAMES.WEBHOOK,
        'fire',
        expect.objectContaining({ endpointId: 'wh1', deliveryId: 'del1' }),
        expect.anything(),
      );
    });

    it('rejects redelivery of a delivery that belongs to a different endpoint', async () => {
      repo.findById.mockResolvedValue(buildEndpoint() as EndpointRow);
      repo.findDelivery.mockResolvedValue({ id: 'del9', endpointId: 'other' });
      await expect(service.redeliver('wh1', 'del9')).rejects.toThrow(NotFoundException);
      expect(queue.enqueue).not.toHaveBeenCalled();
    });

    it('enqueues a redelivery for a matching delivery', async () => {
      repo.findById.mockResolvedValue(buildEndpoint() as EndpointRow);
      repo.findDelivery.mockResolvedValue({ id: 'del1', endpointId: 'wh1' });
      await service.redeliver('wh1', 'del1');
      expect(queue.enqueue).toHaveBeenCalledWith(
        QUEUE_NAMES.WEBHOOK,
        'fire',
        expect.objectContaining({ endpointId: 'wh1', deliveryId: 'del1' }),
        expect.anything(),
      );
    });
  });

  describe('delete', () => {
    it('throws NotFound before deleting a missing endpoint', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.delete('missing')).rejects.toThrow(NotFoundException);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});

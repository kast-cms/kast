import type { ConfigService } from '@nestjs/config';
import { UnrecoverableError, type Job } from 'bullmq';
import { createHmac } from 'crypto';
import { lookup } from 'dns/promises';
import { encryptSecret } from '../../common/utils/secret-crypto.util';
import { WebhookProcessor, type WebhookFireJobData } from './webhook.processor';
import type { EndpointWithSecret, WebhookRepository } from './webhook.repository';

jest.mock('dns/promises', () => ({ lookup: jest.fn() }));

const mockedLookup = lookup as unknown as jest.Mock;
const APP_SECRET = 'unit-test-app-secret-0123456789';
const SIGNING_KEY = 'whsec_unit_test';

type Mocked<T> = { [K in keyof T]: jest.Mock };

function buildEndpoint(url: string): EndpointWithSecret {
  return {
    id: 'wh1',
    name: 'My Hook',
    url,
    secretHash: encryptSecret(SIGNING_KEY, APP_SECRET),
    events: ['content.published'],
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  } as EndpointWithSecret;
}

const DELIVERY = {
  id: 'del1',
  endpointId: 'wh1',
  event: 'content.published',
  payload: { hello: 'world' },
  attempts: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const job = { name: 'fire', data: { endpointId: 'wh1', deliveryId: 'del1' } } as Job<
  WebhookFireJobData,
  void,
  string
>;

describe('WebhookProcessor', () => {
  const realFetch = global.fetch;
  let repo: Mocked<WebhookRepository>;
  let processor: WebhookProcessor;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    delete process.env.WEBHOOK_ALLOWED_HOSTS;
    mockedLookup.mockReset();
    mockedLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    repo = {
      findByIdWithSecret: jest.fn(),
      findDelivery: jest.fn().mockResolvedValue(DELIVERY),
      updateDelivery: jest.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<WebhookRepository>;
    const config = { get: jest.fn().mockReturnValue(APP_SECRET) } as unknown as ConfigService;
    processor = new WebhookProcessor(repo as unknown as WebhookRepository, config);
  });

  afterAll(() => {
    global.fetch = realFetch;
    delete process.env.WEBHOOK_ALLOWED_HOSTS;
  });

  const lastUpdate = (): Record<string, unknown> =>
    repo.updateDelivery.mock.calls[0]?.[1] as Record<string, unknown>;

  it('delivers to a public endpoint and records success with the signature header', async () => {
    repo.findByIdWithSecret.mockResolvedValue(buildEndpoint('https://example.com/hook'));
    fetchMock.mockResolvedValue(new Response('ok', { status: 200 }));

    await processor.process(job);

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const headers = init.headers as Record<string, string>;
    const expected = createHmac('sha256', SIGNING_KEY)
      .update(init.body as string)
      .digest('hex');
    expect(headers['X-Kast-Signature']).toBe(`sha256=${expected}`);
    expect(headers['X-Kast-Event']).toBe('content.published');
    expect(headers['X-Kast-Delivery']).toBe('del1');
    expect(init.redirect).toBe('manual');

    const update = lastUpdate();
    expect(update.statusCode).toBe(200);
    expect(update.responseBody).toBe('ok');
    expect(update.attempts).toBe(1);
    expect(update.succeededAt).toBeInstanceOf(Date);
    expect(update.failedAt).toBeNull();
  });

  it('never connects to a loopback endpoint and marks the delivery blocked', async () => {
    repo.findByIdWithSecret.mockResolvedValue(buildEndpoint('http://127.0.0.1:3000/api/v1/health'));

    await expect(processor.process(job)).rejects.toBeInstanceOf(UnrecoverableError);

    expect(fetchMock).not.toHaveBeenCalled();
    const update = lastUpdate();
    expect(update.responseBody).toBe('blocked by egress policy: private_address');
    expect(update.statusCode).toBeUndefined();
    expect(update.attempts).toBe(1);
    expect(update.failedAt).toBeInstanceOf(Date);
    expect(update.succeededAt).toBeNull();
  });

  it('blocks a public endpoint that redirects into private space', async () => {
    repo.findByIdWithSecret.mockResolvedValue(buildEndpoint('https://example.com/hook'));
    fetchMock.mockResolvedValue(
      new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } }),
    );

    await expect(processor.process(job)).rejects.toBeInstanceOf(UnrecoverableError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lastUpdate().responseBody).toBe(
      'blocked by egress policy: endpoint redirected to http://169.254.169.254/, ' +
        'which was not followed (private_address)',
    );
  });

  it('stores a hostile oversized response truncated at 64 KiB', async () => {
    repo.findByIdWithSecret.mockResolvedValue(buildEndpoint('https://example.com/hook'));
    fetchMock.mockResolvedValue(new Response('a'.repeat(2 * 1024 * 1024), { status: 500 }));

    await expect(processor.process(job)).rejects.toThrow(/failed with status 500/);

    const stored = lastUpdate().responseBody as string;
    expect(stored.endsWith('\n[truncated]')).toBe(true);
    expect(Buffer.byteLength(stored, 'utf8')).toBe(64 * 1024 + '\n[truncated]'.length);
  });

  it('bounds the stored body on the transport-error path too', async () => {
    repo.findByIdWithSecret.mockResolvedValue(buildEndpoint('https://example.com/hook'));
    fetchMock.mockRejectedValue(new Error('x'.repeat(200_000)));

    await expect(processor.process(job)).rejects.toThrow(Error);

    const stored = lastUpdate().responseBody as string;
    expect(Buffer.byteLength(stored, 'utf8')).toBeLessThanOrEqual(64 * 1024 + 32);
  });

  it('retries (plain Error) rather than giving up when the receiver merely errors', async () => {
    repo.findByIdWithSecret.mockResolvedValue(buildEndpoint('https://example.com/hook'));
    fetchMock.mockResolvedValue(new Response('boom', { status: 503 }));

    await expect(processor.process(job)).rejects.not.toBeInstanceOf(UnrecoverableError);
    expect(lastUpdate().statusCode).toBe(503);
  });

  it('keeps retrying when the resolver is merely unavailable', async () => {
    repo.findByIdWithSecret.mockResolvedValue(buildEndpoint('https://receiver.example/hook'));
    mockedLookup.mockRejectedValue(new Error('EAI_AGAIN'));

    await expect(processor.process(job)).rejects.not.toBeInstanceOf(UnrecoverableError);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(lastUpdate().responseBody).toBe('blocked by egress policy: dns_failure');
  });

  it('keeps retrying a receiver stuck in a redirect loop', async () => {
    repo.findByIdWithSecret.mockResolvedValue(buildEndpoint('https://example.com/hook'));
    fetchMock.mockResolvedValue(
      new Response(null, { status: 302, headers: { location: 'https://example.com/hook' } }),
    );

    await expect(processor.process(job)).rejects.not.toBeInstanceOf(UnrecoverableError);

    expect(lastUpdate().responseBody).toBe('blocked by egress policy: too_many_redirects');
  });

  it('delivers to an internal endpoint when the allow-list names it', async () => {
    process.env.WEBHOOK_ALLOWED_HOSTS = '127.0.0.1';
    repo.findByIdWithSecret.mockResolvedValue(buildEndpoint('http://127.0.0.1:3000/hook'));
    fetchMock.mockResolvedValue(new Response('ok', { status: 200 }));

    await processor.process(job);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lastUpdate().succeededAt).toBeInstanceOf(Date);
  });
});

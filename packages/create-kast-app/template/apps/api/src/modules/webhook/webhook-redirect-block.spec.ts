import type { ConfigService } from '@nestjs/config';
import { UnrecoverableError, type Job } from 'bullmq';
import { lookup } from 'dns/promises';
import { encryptSecret } from '../../common/utils/secret-crypto.util';
import { WebhookProcessor, type WebhookFireJobData } from './webhook.processor';
import type { EndpointWithSecret, WebhookRepository } from './webhook.repository';

jest.mock('dns/promises', () => ({ lookup: jest.fn() }));

const mockedLookup = lookup as unknown as jest.Mock;
const APP_SECRET = 'unit-test-app-secret-0123456789';

type Mocked<T> = { [K in keyof T]: jest.Mock };

function buildEndpoint(url: string): EndpointWithSecret {
  return {
    id: 'wh1',
    name: 'Receiver',
    url,
    secretHash: encryptSecret('whsec_x', APP_SECRET),
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

describe('WebhookProcessor blocked redirects', () => {
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
      findByIdWithSecret: jest.fn().mockResolvedValue(buildEndpoint('https://receiver.example/h')),
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

  const redirect = (location: string): Response =>
    new Response(null, { status: 302, headers: { location } });

  const lastUpdate = (): Record<string, unknown> =>
    repo.updateDelivery.mock.calls[0]?.[1] as Record<string, unknown>;

  it('gives up on a mailto: Location and records the target it refused to follow', async () => {
    fetchMock.mockResolvedValue(redirect('mailto:ops@receiver.example'));

    await expect(processor.process(job)).rejects.toBeInstanceOf(UnrecoverableError);

    expect(lastUpdate().responseBody).toBe(
      'blocked by egress policy: endpoint redirected to mailto:ops@receiver.example, ' +
        'which was not followed (unsupported_scheme)',
    );
  });

  it('gives up on a malformed Location and quotes it verbatim', async () => {
    fetchMock.mockResolvedValue(redirect('http://['));

    await expect(processor.process(job)).rejects.toBeInstanceOf(UnrecoverableError);

    expect(lastUpdate().responseBody).toBe(
      'blocked by egress policy: endpoint redirected to http://[, ' +
        'which was not followed (invalid_url)',
    );
  });

  it('reports a redirect refusal differently from the same verdict on the stored URL', async () => {
    repo.findByIdWithSecret.mockResolvedValue(buildEndpoint('ftp://receiver.example/h'));

    await expect(processor.process(job)).rejects.toBeInstanceOf(UnrecoverableError);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(lastUpdate().responseBody).toBe('blocked by egress policy: unsupported_scheme');
  });

  it('repeats the refusal in the job error so the failed-job log matches the delivery row', async () => {
    fetchMock.mockResolvedValue(redirect('mailto:ops@receiver.example'));

    await expect(processor.process(job)).rejects.toThrow(
      /redirected to mailto:ops@receiver\.example/,
    );
  });

  it('truncates an absurdly long redirect target before storing it', async () => {
    fetchMock.mockResolvedValue(redirect(`http://10.0.0.5:8080/${'a'.repeat(500)}`));

    await expect(processor.process(job)).rejects.toBeInstanceOf(UnrecoverableError);

    const stored = lastUpdate().responseBody as string;
    expect(stored).toContain('http://10.0.0.5:8080/aaa');
    expect(stored).toContain('..., which was not followed (private_address)');
    expect(stored.length).toBeLessThan(320);
  });

  it('keeps the retry budget when the receiver is merely down', async () => {
    fetchMock.mockRejectedValue(new Error('fetch failed: ECONNREFUSED'));

    await expect(processor.process(job)).rejects.not.toBeInstanceOf(UnrecoverableError);

    const stored = lastUpdate().responseBody as string;
    expect(stored).toContain('ECONNREFUSED');
    expect(stored).not.toContain('egress policy');
  });

  it('keeps the retry budget when a redirect target merely fails to resolve', async () => {
    fetchMock.mockResolvedValue(redirect('https://cdn.receiver.example/h'));
    mockedLookup
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockRejectedValue(new Error('EAI_AGAIN'));

    await expect(processor.process(job)).rejects.not.toBeInstanceOf(UnrecoverableError);

    expect(lastUpdate().responseBody).toBe(
      'blocked by egress policy: endpoint redirected to https://cdn.receiver.example/h, ' +
        'which was not followed (dns_failure)',
    );
  });
});

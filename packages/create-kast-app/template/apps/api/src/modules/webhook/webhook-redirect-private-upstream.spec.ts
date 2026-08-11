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

// A perfectly public customer endpoint whose nginx runs `proxy_redirect off` and
// echoes its own upstream's private address back in `Location`.
describe('WebhookProcessor: public endpoint redirecting to its private upstream', () => {
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
      findByIdWithSecret: jest.fn().mockResolvedValue({
        id: 'wh1',
        name: 'Acme',
        url: 'https://hooks.acme.example/kast',
        secretHash: encryptSecret('whsec_x', APP_SECRET),
        events: ['content.published'],
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      } as EndpointWithSecret),
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

  it('stops the delivery for good and names the address it refused', async () => {
    fetchMock.mockResolvedValue(
      new Response('internal upstream body', {
        status: 302,
        headers: { location: 'http://10.0.0.5:8080/kast' },
      }),
    );

    await expect(processor.process(job)).rejects.toBeInstanceOf(UnrecoverableError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const update = lastUpdate();
    expect(update.responseBody).toBe(
      'blocked by egress policy: endpoint redirected to http://10.0.0.5:8080/kast, ' +
        'which was not followed (private_address)',
    );
    expect(update.responseBody).not.toContain('internal upstream body');
    expect(update.statusCode).toBeUndefined();
    expect(update.attempts).toBe(1);
    expect(update.failedAt).toBeInstanceOf(Date);
    expect(update.succeededAt).toBeNull();
  });

  it('does not read like the endpoint being down', async () => {
    fetchMock.mockRejectedValue(new Error('fetch failed: connect ECONNREFUSED 93.184.216.34:443'));

    await expect(processor.process(job)).rejects.not.toBeInstanceOf(UnrecoverableError);

    const stored = lastUpdate().responseBody as string;
    expect(stored).toContain('ECONNREFUSED');
    expect(stored).not.toContain('redirected');
  });
});

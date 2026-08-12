import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { StripePlugin } from './index';

const ENV_KEYS = [
  'KAST_API_URL',
  'KAST_API_TOKEN',
  'KAST_API_KEY',
  'PORT',
  'STRIPE_PRODUCT_TYPE_SLUG',
];

interface RecordedCall {
  url: string;
  init: RequestInit | undefined;
}

const realFetch = globalThis.fetch;
const realStderrWrite = process.stderr.write.bind(process.stderr);
let savedEnv: Record<string, string | undefined> = {};

function stubFetch(respond: () => Response): RecordedCall[] {
  const calls: RecordedCall[] = [];
  globalThis.fetch = ((input: unknown, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), init });
    return Promise.resolve(respond());
  }) as unknown as typeof fetch;
  return calls;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function fetchEntryFields(
  plugin: StripePlugin,
  entryId: string,
): Promise<Record<string, unknown> | null> {
  return plugin['fetchEntryFields'](entryId);
}

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  process.env['KAST_API_TOKEN'] = 'kast_secret';
  process.stderr.write = (() => true) as typeof process.stderr.write;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  globalThis.fetch = realFetch;
  process.stderr.write = realStderrWrite;
});

void describe('StripePlugin.fetchEntryFields', () => {
  void it('reads the product entry from the API port with the Kast key attached', async () => {
    const calls = stubFetch(() =>
      jsonResponse({ data: { id: 'e1', locales: [{ data: { name: 'Mug' } }] } }),
    );
    const plugin = new StripePlugin();

    assert.deepEqual(await fetchEntryFields(plugin, 'e1'), { name: 'Mug' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, 'http://127.0.0.1:3000/api/v1/content-types/product/entries/e1');
    assert.equal(new Headers(calls[0]?.init?.headers).get('x-kast-key'), 'kast_secret');
  });

  void it('uses the configured product type slug', async () => {
    process.env['STRIPE_PRODUCT_TYPE_SLUG'] = 'shop-item';
    const calls = stubFetch(() => jsonResponse({ data: { id: 'e1', locales: [] } }));
    const plugin = new StripePlugin();
    plugin['productTypeSlug'] = 'shop-item';

    await fetchEntryFields(plugin, 'e1');
    assert.match(calls[0]?.url ?? '', /content-types\/shop-item\/entries\/e1$/);
  });

  void it('returns an empty object for a readable entry that carries no locale data', async () => {
    stubFetch(() => jsonResponse({ data: { id: 'e1', locales: [] } }));
    const plugin = new StripePlugin();

    assert.deepEqual(await fetchEntryFields(plugin, 'e1'), {});
  });

  void it('returns null when the entry cannot be read', async () => {
    stubFetch(() => new Response('', { status: 401 }));
    const plugin = new StripePlugin();

    assert.equal(await fetchEntryFields(plugin, 'e1'), null);
  });

  void it('returns null without calling the API when no token is configured', async () => {
    delete process.env['KAST_API_TOKEN'];
    const calls = stubFetch(() => jsonResponse({ data: { id: 'e1', locales: [] } }));
    const plugin = new StripePlugin();

    assert.equal(await fetchEntryFields(plugin, 'e1'), null);
    assert.equal(calls.length, 0);
  });
});

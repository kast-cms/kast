import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { KastApiClient, resolveKastApiBaseUrl, resolveKastApiToken } from './kast-api.js';

const ENV_KEYS = ['KAST_API_URL', 'KAST_API_TOKEN', 'KAST_API_KEY', 'PORT'];

const realFetch = globalThis.fetch;
let savedEnv: Record<string, string | undefined> = {};

interface RecordedCall {
  url: string;
  init: RequestInit | undefined;
}

function stubFetch(respond: () => Response | Promise<Response>): RecordedCall[] {
  const calls: RecordedCall[] = [];
  globalThis.fetch = ((input: unknown, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), init });
    return Promise.resolve(respond());
  }) as unknown as typeof fetch;
  return calls;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  globalThis.fetch = realFetch;
});

void describe('resolveKastApiBaseUrl', () => {
  void it('falls back to the API port on loopback, never the admin port 3001', () => {
    assert.equal(resolveKastApiBaseUrl(), 'http://127.0.0.1:3000');
  });

  void it('follows PORT when the API is not on its default port', () => {
    process.env['PORT'] = '4000';
    assert.equal(resolveKastApiBaseUrl(), 'http://127.0.0.1:4000');
  });

  void it('strips trailing slashes from a configured origin', () => {
    process.env['KAST_API_URL'] = 'https://cms.example.com//';
    assert.equal(resolveKastApiBaseUrl(), 'https://cms.example.com');
  });

  void it('treats a blank origin as unset', () => {
    process.env['KAST_API_URL'] = '   ';
    assert.equal(resolveKastApiBaseUrl(), 'http://127.0.0.1:3000');
  });
});

void describe('resolveKastApiToken', () => {
  void it('is undefined when nothing is configured', () => {
    assert.equal(resolveKastApiToken(), undefined);
  });

  void it('prefers KAST_API_TOKEN over KAST_API_KEY', () => {
    process.env['KAST_API_TOKEN'] = 'kast_primary';
    process.env['KAST_API_KEY'] = 'kast_fallback';
    assert.equal(resolveKastApiToken(), 'kast_primary');
  });

  void it('falls back to KAST_API_KEY', () => {
    process.env['KAST_API_KEY'] = 'kast_fallback';
    assert.equal(resolveKastApiToken(), 'kast_fallback');
  });

  void it('treats a blank token as unset', () => {
    process.env['KAST_API_TOKEN'] = '  ';
    assert.equal(resolveKastApiToken(), undefined);
  });
});

void describe('KastApiClient.fetchEntry', () => {
  void it('does not call the API and warns once when no token is configured', async () => {
    const warnings: string[] = [];
    const calls = stubFetch(() => jsonResponse({ data: { id: 'e1' } }));
    const client = new KastApiClient((message) => warnings.push(message));

    assert.equal(client.isConfigured, false);
    assert.equal(await client.fetchEntry('blog-post', 'e1'), null);
    assert.equal(await client.fetchEntry('blog-post', 'e2'), null);

    assert.equal(calls.length, 0);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0] ?? '', /KAST_API_TOKEN/);
  });

  void it('authenticates the management request and unwraps the envelope', async () => {
    process.env['KAST_API_TOKEN'] = 'kast_secret';
    process.env['KAST_API_URL'] = 'http://api.internal:3000/';
    const calls = stubFetch(() => jsonResponse({ data: { id: 'e1', title: 'Hi' } }));
    const client = new KastApiClient(() => undefined);

    const entry = await client.fetchEntry<{ id: string; title: string }>('blog post', 'e/1');

    assert.deepEqual(entry, { id: 'e1', title: 'Hi' });
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0]?.url,
      'http://api.internal:3000/api/v1/content-types/blog%20post/entries/e%2F1',
    );
    const headers = new Headers(calls[0]?.init?.headers);
    assert.equal(headers.get('x-kast-key'), 'kast_secret');
    assert.equal(headers.get('accept'), 'application/json');
    assert.ok(calls[0]?.init?.signal, 'request must carry a timeout signal');
  });

  void it('warns once when the token is rejected', async () => {
    process.env['KAST_API_TOKEN'] = 'kast_bad';
    const warnings: string[] = [];
    stubFetch(() => new Response('', { status: 401 }));
    const client = new KastApiClient((message) => warnings.push(message));

    assert.equal(await client.fetchEntry('blog-post', 'e1'), null);
    assert.equal(await client.fetchEntry('blog-post', 'e2'), null);

    assert.equal(warnings.length, 1);
    assert.match(warnings[0] ?? '', /KAST_API_TOKEN/);
    assert.match(warnings[0] ?? '', /401/);
  });

  void it('returns null without warning for other error statuses', async () => {
    process.env['KAST_API_TOKEN'] = 'kast_secret';
    const warnings: string[] = [];
    stubFetch(() => new Response('', { status: 404 }));
    const client = new KastApiClient((message) => warnings.push(message));

    assert.equal(await client.fetchEntry('blog-post', 'missing'), null);
    assert.deepEqual(warnings, []);
  });

  void it('returns null when the envelope carries no data', async () => {
    process.env['KAST_API_TOKEN'] = 'kast_secret';
    stubFetch(() => jsonResponse({}));
    const client = new KastApiClient(() => undefined);

    assert.equal(await client.fetchEntry('blog-post', 'e1'), null);
  });

  void it('propagates transport failures so the caller can log them', async () => {
    process.env['KAST_API_TOKEN'] = 'kast_secret';
    globalThis.fetch = (() => Promise.reject(new Error('ECONNREFUSED'))) as unknown as typeof fetch;
    const client = new KastApiClient(() => undefined);

    await assert.rejects(() => client.fetchEntry('blog-post', 'e1'), /ECONNREFUSED/);
  });
});

void describe('KastApiClient.contentTypeExists', () => {
  void it('authenticates the request and reports an existing type', async () => {
    process.env['KAST_API_TOKEN'] = 'kast_secret';
    const calls = stubFetch(() => jsonResponse({ data: { name: 'content' } }));
    const client = new KastApiClient(() => undefined);

    assert.equal(await client.contentTypeExists('content'), true);
    assert.equal(calls[0]?.url, 'http://127.0.0.1:3000/api/v1/content-types/content');
    assert.equal(new Headers(calls[0]?.init?.headers).get('x-kast-key'), 'kast_secret');
  });

  void it('reports a missing type as absent, not unknown', async () => {
    process.env['KAST_API_TOKEN'] = 'kast_secret';
    stubFetch(() => new Response('', { status: 404 }));
    const client = new KastApiClient(() => undefined);

    assert.equal(await client.contentTypeExists('content'), false);
  });

  void it('answers null when the API cannot be asked', async () => {
    process.env['KAST_API_TOKEN'] = 'kast_secret';
    globalThis.fetch = (() => Promise.reject(new Error('ECONNREFUSED'))) as unknown as typeof fetch;
    const client = new KastApiClient(() => undefined);

    assert.equal(await client.contentTypeExists('content'), null);
  });

  void it('answers null on a server error rather than guessing', async () => {
    process.env['KAST_API_TOKEN'] = 'kast_secret';
    stubFetch(() => new Response('', { status: 500 }));
    const client = new KastApiClient(() => undefined);

    assert.equal(await client.contentTypeExists('content'), null);
  });

  void it('answers null and warns once when the token is rejected', async () => {
    process.env['KAST_API_TOKEN'] = 'kast_bad';
    const warnings: string[] = [];
    stubFetch(() => new Response('', { status: 403 }));
    const client = new KastApiClient((message) => warnings.push(message));

    assert.equal(await client.contentTypeExists('content'), null);
    assert.equal(await client.contentTypeExists('content'), null);

    assert.equal(warnings.length, 1);
    assert.match(warnings[0] ?? '', /403/);
  });

  void it('does not call the API when no token is configured', async () => {
    const calls = stubFetch(() => jsonResponse({ data: {} }));
    const client = new KastApiClient(() => undefined);

    assert.equal(await client.contentTypeExists('content'), null);
    assert.equal(calls.length, 0);
  });
});

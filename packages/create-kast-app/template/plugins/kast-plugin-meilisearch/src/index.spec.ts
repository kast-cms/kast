import { PluginHook, type KastPluginContext } from '@kast-cms/plugin-sdk';
import type { Meilisearch } from 'meilisearch';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { MeilisearchPlugin } from './index.js';

const ENV_KEYS = [
  'KAST_API_URL',
  'KAST_API_TOKEN',
  'KAST_API_KEY',
  'PORT',
  'MEILISEARCH_HOST',
  'MEILISEARCH_MASTER_KEY',
  'MEILISEARCH_INDEX_PREFIX',
  'MEILISEARCH_AGGREGATE_INDEX',
];

/** One recorded write against a Meilisearch index. */
interface IndexOp {
  uid: string;
  op: 'add' | 'delete' | 'filterable';
  values: string[];
}

const realFetch = globalThis.fetch;
const realStderrWrite = process.stderr.write.bind(process.stderr);
let savedEnv: Record<string, string | undefined> = {};

function fakeClient(ops: IndexOp[]): Meilisearch {
  return {
    createIndex: () => Promise.resolve(undefined),
    index: (uid: string) => ({
      addDocuments: (docs: Array<{ id: string }>) => {
        ops.push({ uid, op: 'add', values: docs.map((doc) => doc.id) });
        return Promise.resolve(undefined);
      },
      deleteDocument: (id: string) => {
        ops.push({ uid, op: 'delete', values: [id] });
        return Promise.resolve(undefined);
      },
      updateFilterableAttributes: (attributes: string[]) => {
        ops.push({ uid, op: 'filterable', values: attributes });
        return Promise.resolve(undefined);
      },
      search: (query: string) => Promise.resolve({ uid, query, hits: [] }),
    }),
  } as unknown as Meilisearch;
}

function fakeContext(
  handlers: Map<string, (payload: unknown) => void | Promise<void>>,
): KastPluginContext {
  return {
    pluginName: 'kast-plugin-meilisearch',
    on(event: PluginHook, handler: (payload: unknown) => void | Promise<void>): void {
      handlers.set(event, handler);
    },
    getConfig: () => Promise.resolve({}),
    setConfig: () => Promise.resolve(),
    registerEmailTransport: () => undefined,
    registerStorageAdapter: () => undefined,
    registerErrorReporter: () => undefined,
  };
}

/** Every management URL the plugin requests, in order. */
let apiCalls: string[] = [];

/**
 * Serves the two management reads the plugin makes: the entry body, and
 * whether a content type exists (404 = it does not).
 */
function stubKastApi(options: { entry?: unknown; contentTypeStatus?: number } = {}): void {
  globalThis.fetch = ((input: unknown) => {
    const url = String(input);
    apiCalls.push(url);
    if (/\/content-types\/[^/]+$/.test(url)) {
      return Promise.resolve(new Response('', { status: options.contentTypeStatus ?? 404 }));
    }
    return Promise.resolve(
      new Response(JSON.stringify({ data: options.entry ?? null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }) as unknown as typeof fetch;
}

function stubEntryFetch(entry: unknown): void {
  stubKastApi({ entry });
}

/** Boots a plugin with a stubbed Meilisearch client and returns its recorded writes. */
async function bootPlugin(): Promise<{
  plugin: MeilisearchPlugin;
  ops: IndexOp[];
  handlers: Map<string, (payload: unknown) => void | Promise<void>>;
}> {
  const ops: IndexOp[] = [];
  const handlers = new Map<string, (payload: unknown) => void | Promise<void>>();
  const plugin = new MeilisearchPlugin();
  await plugin.onLoad(fakeContext(handlers));
  plugin['client'] = fakeClient(ops);
  return { plugin, ops, handlers };
}

async function emit(
  handlers: Map<string, (payload: unknown) => void | Promise<void>>,
  hook: PluginHook,
  payload: unknown,
): Promise<void> {
  const handler = handlers.get(hook);
  assert.ok(handler, `no handler registered for ${hook}`);
  await handler(payload);
}

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  process.env['MEILISEARCH_HOST'] = 'http://127.0.0.1:7700';
  process.env['MEILISEARCH_MASTER_KEY'] = 'master';
  process.env['KAST_API_TOKEN'] = 'kast_secret';
  process.stderr.write = (() => true) as typeof process.stderr.write;
  apiCalls = [];
  stubKastApi();
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

void describe('MeilisearchPlugin indexing', () => {
  void it('writes a published entry to both the per-type and aggregate indexes', async () => {
    stubEntryFetch({ id: 'e1', status: 'PUBLISHED', locales: [{ localeCode: 'en', data: {} }] });
    const { ops, handlers } = await bootPlugin();

    await emit(handlers, PluginHook.CONTENT_PUBLISHED, {
      entryId: 'e1',
      typeSlug: 'blog-post',
      status: 'PUBLISHED',
    });

    const adds = ops.filter((op) => op.op === 'add');
    assert.deepEqual(adds.map((op) => op.uid).sort(), ['kast_blog-post', 'kast_content']);
    assert.ok(adds.every((op) => op.values[0] === 'e1'));
  });

  void it('declares typeSlug filterable on the aggregate index only once', async () => {
    stubEntryFetch({ id: 'e1', locales: [] });
    const { ops, handlers } = await bootPlugin();

    await emit(handlers, PluginHook.CONTENT_PUBLISHED, { entryId: 'e1', typeSlug: 'blog-post' });
    await emit(handlers, PluginHook.CONTENT_PUBLISHED, { entryId: 'e2', typeSlug: 'blog-post' });

    const filterable = ops.filter((op) => op.op === 'filterable');
    assert.equal(filterable.length, 1);
    assert.deepEqual(filterable[0], {
      uid: 'kast_content',
      op: 'filterable',
      values: ['typeSlug'],
    });
  });

  void it('removes an unpublished entry from both indexes', async () => {
    const { ops, handlers } = await bootPlugin();

    await emit(handlers, PluginHook.CONTENT_UNPUBLISHED, { entryId: 'e1', typeSlug: 'blog-post' });

    const deletes = ops.filter((op) => op.op === 'delete');
    assert.deepEqual(deletes.map((op) => op.uid).sort(), ['kast_blog-post', 'kast_content']);
  });

  void it('removes an entry from both indexes when an update drops it out of PUBLISHED', async () => {
    const { ops, handlers } = await bootPlugin();

    await emit(handlers, PluginHook.CONTENT_UPDATED, {
      entryId: 'e1',
      typeSlug: 'blog-post',
      status: 'DRAFT',
    });

    assert.deepEqual(
      ops
        .filter((op) => op.op === 'delete')
        .map((op) => op.uid)
        .sort(),
      ['kast_blog-post', 'kast_content'],
    );
  });

  void it('writes only the per-type index when the aggregate index is disabled', async () => {
    process.env['MEILISEARCH_AGGREGATE_INDEX'] = 'false';
    stubEntryFetch({ id: 'e1', locales: [] });
    const { ops, handlers } = await bootPlugin();

    await emit(handlers, PluginHook.CONTENT_PUBLISHED, { entryId: 'e1', typeSlug: 'blog-post' });

    assert.deepEqual(
      ops.map((op) => op.uid),
      ['kast_blog-post'],
    );
  });

  void it('does not write a content type named "content" twice', async () => {
    stubEntryFetch({ id: 'e1', locales: [] });
    const { ops, handlers } = await bootPlugin();

    await emit(handlers, PluginHook.CONTENT_PUBLISHED, { entryId: 'e1', typeSlug: 'content' });

    assert.deepEqual(
      ops.filter((op) => op.op === 'add').map((op) => op.uid),
      ['kast_content'],
    );
  });

  void it('indexes nothing when no Kast API token is configured', async () => {
    delete process.env['KAST_API_TOKEN'];
    stubEntryFetch({ id: 'e1', locales: [] });
    const { ops, handlers } = await bootPlugin();

    await emit(handlers, PluginHook.CONTENT_PUBLISHED, { entryId: 'e1', typeSlug: 'blog-post' });

    assert.deepEqual(ops, []);
  });

  void it('honours a custom index prefix for the aggregate index', async () => {
    process.env['MEILISEARCH_INDEX_PREFIX'] = 'acme_';
    stubEntryFetch({ id: 'e1', locales: [] });
    const { ops, handlers } = await bootPlugin();

    await emit(handlers, PluginHook.CONTENT_PUBLISHED, { entryId: 'e1', typeSlug: 'blog-post' });

    assert.deepEqual(
      ops
        .filter((op) => op.op === 'add')
        .map((op) => op.uid)
        .sort(),
      ['acme_blog-post', 'acme_content'],
    );
  });
});

void describe('MeilisearchPlugin aggregate index ownership', () => {
  const probeCalls = (): string[] => apiCalls.filter((url) => /\/content-types\/[^/]+$/.test(url));

  void it('writes no other type into the index a content type named "content" owns', async () => {
    stubKastApi({ entry: { id: 'e1', locales: [] }, contentTypeStatus: 200 });
    const { ops, handlers } = await bootPlugin();

    await emit(handlers, PluginHook.CONTENT_PUBLISHED, { entryId: 'e1', typeSlug: 'blog-post' });

    assert.deepEqual(
      ops.map((op) => `${op.op}:${op.uid}`),
      ['add:kast_blog-post'],
    );
    assert.deepEqual(probeCalls(), ['http://127.0.0.1:3000/api/v1/content-types/content']);
  });

  void it('keeps foreign deletes off that index as well', async () => {
    stubKastApi({ contentTypeStatus: 200 });
    const { ops, handlers } = await bootPlugin();

    await emit(handlers, PluginHook.CONTENT_UNPUBLISHED, { entryId: 'e1', typeSlug: 'blog-post' });

    assert.deepEqual(
      ops.map((op) => `${op.op}:${op.uid}`),
      ['delete:kast_blog-post'],
    );
  });

  void it('stops aggregate writes once an entry of the colliding type is seen', async () => {
    stubKastApi({ entry: { id: 'e1', locales: [] } });
    const { ops, handlers } = await bootPlugin();

    await emit(handlers, PluginHook.CONTENT_PUBLISHED, { entryId: 'e1', typeSlug: 'content' });
    assert.deepEqual(probeCalls(), [], 'the event itself proves the type exists');

    await emit(handlers, PluginHook.CONTENT_PUBLISHED, { entryId: 'e2', typeSlug: 'blog-post' });

    assert.deepEqual(
      ops.filter((op) => op.op === 'add').map((op) => op.uid),
      ['kast_content', 'kast_blog-post'],
    );
  });

  void it('asks the API once per window, not once per entry', async () => {
    stubKastApi({ entry: { id: 'e1', locales: [] } });
    const { ops, handlers } = await bootPlugin();

    await emit(handlers, PluginHook.CONTENT_PUBLISHED, { entryId: 'e1', typeSlug: 'blog-post' });
    await emit(handlers, PluginHook.CONTENT_PUBLISHED, { entryId: 'e2', typeSlug: 'blog-post' });

    assert.equal(probeCalls().length, 1);
    assert.equal(ops.filter((op) => op.uid === 'kast_content' && op.op === 'add').length, 2);
  });

  void it('re-asks after an inconclusive answer instead of trusting it', async () => {
    stubKastApi({ entry: { id: 'e1', locales: [] }, contentTypeStatus: 500 });
    const { ops, handlers } = await bootPlugin();

    await emit(handlers, PluginHook.CONTENT_PUBLISHED, { entryId: 'e1', typeSlug: 'blog-post' });
    assert.deepEqual(
      ops.filter((op) => op.op === 'add').map((op) => op.uid),
      ['kast_blog-post', 'kast_content'],
    );

    stubKastApi({ entry: { id: 'e2', locales: [] }, contentTypeStatus: 200 });
    await emit(handlers, PluginHook.CONTENT_PUBLISHED, { entryId: 'e2', typeSlug: 'blog-post' });

    assert.deepEqual(
      ops.filter((op) => op.op === 'add' && op.values[0] === 'e2').map((op) => op.uid),
      ['kast_blog-post'],
    );
    assert.equal(probeCalls().length, 2);
  });

  void it('never asks the API when the aggregate index is switched off', async () => {
    process.env['MEILISEARCH_AGGREGATE_INDEX'] = 'false';
    stubKastApi({ entry: { id: 'e1', locales: [] } });
    const { ops, handlers } = await bootPlugin();

    await emit(handlers, PluginHook.CONTENT_PUBLISHED, { entryId: 'e1', typeSlug: 'blog-post' });

    assert.deepEqual(probeCalls(), []);
    assert.deepEqual(
      ops.map((op) => op.uid),
      ['kast_blog-post'],
    );
  });
});

void describe('MeilisearchPlugin search', () => {
  void it('targets the aggregate index when no type is given', async () => {
    const { plugin } = await bootPlugin();
    const result = (await plugin.search(undefined, 'hello')) as unknown as { uid: string };
    assert.equal(result.uid, 'kast_content');
  });

  void it('targets the per-type index when a type is given', async () => {
    const { plugin } = await bootPlugin();
    const result = (await plugin.search('blog-post', 'hello')) as unknown as { uid: string };
    assert.equal(result.uid, 'kast_blog-post');
  });
});

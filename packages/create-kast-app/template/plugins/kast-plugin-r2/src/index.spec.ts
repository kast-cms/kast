import type { KastPluginContext, PluginStorageAdapter } from '@kast-cms/plugin-sdk';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { R2Plugin } from './index';

const ENV_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
];

afterEach(() => ENV_KEYS.forEach((key) => delete process.env[key]));

test('registers and unloads the R2 storage extension', async () => {
  process.env['R2_ACCOUNT_ID'] = 'account';
  process.env['R2_ACCESS_KEY_ID'] = 'access';
  process.env['R2_SECRET_ACCESS_KEY'] = 'secret';
  process.env['R2_BUCKET_NAME'] = 'media';
  process.env['R2_PUBLIC_URL'] = 'https://media.example.com/';
  let adapter: PluginStorageAdapter | undefined;
  let config: Record<string, unknown> | undefined;
  const ctx = {
    setConfig: async (value: Record<string, unknown>) => {
      config = value;
    },
    registerStorageAdapter: (value: PluginStorageAdapter) => {
      adapter = value;
    },
  } as KastPluginContext;
  const plugin = new R2Plugin();

  await plugin.onLoad(ctx);

  assert.equal(plugin.isReady(), true);
  assert.equal(adapter?.provider, 'r2');
  assert.equal(config?.['provider'], 'r2');
  assert.equal(plugin.publicUrlFor('/photo.jpg'), 'https://media.example.com/photo.jpg');
  await plugin.onUnload?.();
  assert.equal(plugin.isReady(), false);
});

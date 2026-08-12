import type { KastPluginContext, PluginEmailTransport } from '@kast-cms/plugin-sdk';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { ResendPlugin } from './index';

afterEach(() => {
  delete process.env['RESEND_API_KEY'];
  delete process.env['RESEND_FROM_EMAIL'];
  delete process.env['RESEND_FROM_NAME'];
});

test('registers and unloads the Resend email extension', async () => {
  process.env['RESEND_API_KEY'] = 're_test_key';
  process.env['RESEND_FROM_EMAIL'] = 'mail@example.com';
  process.env['RESEND_FROM_NAME'] = 'Kast';
  let transport: PluginEmailTransport | undefined;
  let config: Record<string, unknown> | undefined;
  const ctx = {
    setConfig: async (value: Record<string, unknown>) => {
      config = value;
    },
    registerEmailTransport: (value: PluginEmailTransport) => {
      transport = value;
    },
  } as KastPluginContext;
  const plugin = new ResendPlugin();

  await plugin.onLoad(ctx);

  assert.equal(plugin.isReady(), true);
  assert.equal(transport?.provider, 'resend');
  assert.equal(config?.['fromEmail'], 'mail@example.com');
  await plugin.onUnload?.();
  assert.equal(plugin.isReady(), false);
});

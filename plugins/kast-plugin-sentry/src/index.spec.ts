import type { KastPluginContext, PluginErrorReporter } from '@kast-cms/plugin-sdk';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { SentryPlugin } from './index';

afterEach(() => {
  delete process.env['SENTRY_DSN'];
  delete process.env['SENTRY_ENVIRONMENT'];
  delete process.env['SENTRY_TRACES_SAMPLE_RATE'];
});

test('registers and unloads the Sentry error reporter', async () => {
  process.env['SENTRY_DSN'] = 'https://public@example.com/1';
  process.env['SENTRY_ENVIRONMENT'] = 'test';
  let reporter: PluginErrorReporter | undefined;
  let config: Record<string, unknown> | undefined;
  const ctx = {
    setConfig: async (value: Record<string, unknown>) => {
      config = value;
    },
    registerErrorReporter: (value: PluginErrorReporter) => {
      reporter = value;
    },
  } as KastPluginContext;
  const plugin = new SentryPlugin();

  await plugin.onLoad(ctx);

  assert.equal(plugin.isReady(), true);
  assert.equal(reporter?.provider, 'sentry');
  assert.equal(config?.['environment'], 'test');
  await plugin.onUnload?.();
  assert.equal(plugin.isReady(), false);
});

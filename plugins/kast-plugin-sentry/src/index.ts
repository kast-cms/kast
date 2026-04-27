import { IKastPlugin, KastPluginContext } from '@kast/plugin-sdk';

/**
 * kast-plugin-sentry
 *
 * Activates Sentry error reporting in the Kast API.
 * When SENTRY_DSN is set, the API's GlobalExceptionFilter automatically
 * forwards all 5xx errors to Sentry — no code changes required.
 *
 * This plugin validates the DSN at boot and persists the configuration
 * for the admin UI.
 */
export class SentryPlugin implements IKastPlugin {
  async onLoad(ctx: KastPluginContext): Promise<void> {
    const dsn = process.env['SENTRY_DSN'];
    const environment = process.env['SENTRY_ENVIRONMENT'] ?? 'production';

    if (!dsn) {
      console.warn('[kast-plugin-sentry] SENTRY_DSN not set — error reporting disabled');
      return;
    }

    await ctx.setConfig({
      provider: 'sentry',
      environment,
      tracesSampleRate: process.env['SENTRY_TRACES_SAMPLE_RATE'] ?? '0.1',
      configuredAt: new Date().toISOString(),
    });

    console.log(`[kast-plugin-sentry] Active — reporting errors to Sentry (env: ${environment})`);
  }
}

export default SentryPlugin;

import { type IKastPlugin, type KastPluginContext } from '@kast-cms/plugin-sdk';
import * as Sentry from '@sentry/node';

const LOG_PREFIX = '[kast-plugin-sentry]';

/**
 * Initializes Sentry error monitoring using the official `@sentry/node` SDK.
 *
 * Calling `Sentry.init` at load time installs Sentry's global handlers, so
 * uncaught exceptions and unhandled promise rejections in the host process are
 * reported automatically. `captureException` / `captureMessage` are also
 * exposed so the host (e.g. a Nest exception filter) can forward handled errors.
 *
 * The plugin also registers a request-scoped reporter for handled server errors.
 */
export class SentryPlugin implements IKastPlugin {
  private initialized = false;

  async onLoad(ctx: KastPluginContext): Promise<void> {
    const dsn = process.env['SENTRY_DSN'] ?? '';
    const environment = process.env['SENTRY_ENVIRONMENT'] ?? 'production';
    const tracesSampleRate = parseSampleRate(process.env['SENTRY_TRACES_SAMPLE_RATE']);

    if (!dsn) {
      this.warn('SENTRY_DSN not set — error reporting disabled');
      return;
    }

    Sentry.init({
      dsn,
      environment,
      tracesSampleRate,
    });
    this.initialized = true;

    await ctx.setConfig({
      provider: 'sentry',
      environment,
      tracesSampleRate,
      configuredAt: new Date().toISOString(),
    });

    ctx.registerErrorReporter({
      provider: 'sentry',
      captureException: (error, context) => {
        this.captureException(error, context);
      },
    });

    this.log(`Active — reporting to Sentry (env: ${environment}, traces: ${tracesSampleRate})`);
  }

  /** True once Sentry has been initialized with a DSN. */
  isReady(): boolean {
    return this.initialized;
  }

  /** Reports a handled exception to Sentry. No-op until initialized. */
  captureException(error: unknown, context?: Record<string, unknown>): string | undefined {
    if (!this.initialized) return undefined;
    return Sentry.captureException(error, context ? { extra: context } : undefined);
  }

  /** Reports a message to Sentry. No-op until initialized. */
  captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): string | undefined {
    if (!this.initialized) return undefined;
    return Sentry.captureMessage(message, level);
  }

  /** Flushes buffered events; call before process shutdown. */
  async flush(timeoutMs = 2000): Promise<boolean> {
    if (!this.initialized) return true;
    return Sentry.flush(timeoutMs);
  }

  async onUnload(): Promise<void> {
    await this.flush();
    this.initialized = false;
  }

  private log(message: string): void {
    process.stderr.write(`${LOG_PREFIX} ${message}\n`);
  }

  private warn(message: string): void {
    process.stderr.write(`${LOG_PREFIX} WARN ${message}\n`);
  }
}

/** Parses SENTRY_TRACES_SAMPLE_RATE, clamping to [0, 1] with a 0.1 default. */
function parseSampleRate(raw: string | undefined): number {
  const parsed = raw !== undefined ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) return 0.1;
  return Math.min(1, Math.max(0, parsed));
}

export default SentryPlugin;

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';

/**
 * Thin wrapper around the Sentry Node.js SDK.
 * Conditionally initialized based on SENTRY_DSN env var.
 * Loaded as a provider so it can be injected into the GlobalExceptionFilter.
 */
@Injectable()
export class SentryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SentryService.name);
  private sentry: { captureException(err: unknown, ctx?: Record<string, unknown>): void } | null =
    null;

  constructor(private readonly config: ConfigService<Env>) {}

  async onApplicationBootstrap(): Promise<void> {
    const dsn = this.config.get('SENTRY_DSN', { infer: true });
    if (!dsn) return;

    interface SentryModule {
      init(opts: { dsn: string; environment: string; tracesSampleRate: number }): void;
      captureException(err: unknown, ctx?: { extra?: Record<string, unknown> }): void;
    }

    try {
      // Dynamic import keeps @sentry/node optional

      // @ts-ignore -- @sentry/node is an optional peer dependency
      const Sentry = (await import('@sentry/node')) as unknown as SentryModule;
      Sentry.init({
        dsn,
        environment: this.config.get('SENTRY_ENVIRONMENT', { infer: true }) ?? 'production',
        tracesSampleRate: this.config.get('SENTRY_TRACES_SAMPLE_RATE', { infer: true }) ?? 0.1,
      });
      this.sentry = {
        captureException: (err, ctx) =>
          Sentry.captureException(err, ctx ? { extra: ctx } : undefined),
      };
      this.logger.log('Sentry initialized');
    } catch (err) {
      this.logger.warn(`Could not initialize Sentry (is @sentry/node installed?): ${String(err)}`);
    }
  }

  captureException(err: unknown, context?: Record<string, unknown>): void {
    this.sentry?.captureException(err, context);
  }

  isActive(): boolean {
    return this.sentry !== null;
  }
}

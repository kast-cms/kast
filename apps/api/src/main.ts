import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import type { Env } from './config/env.schema';

function applyHelmet(app: INestApplication, siteUrl: string): void {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
          frameAncestors: [siteUrl],
          upgradeInsecureRequests: [],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xContentTypeOptions: true,
      xFrameOptions: { action: 'deny' },
      xXssProtection: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
}

function applySwagger(app: INestApplication): void {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Kast CMS API')
    .setDescription('Kast CMS REST API — Cast Your Content Everywhere')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-Kast-Key', in: 'header' }, 'X-Kast-Key')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  const configService = app.get<ConfigService<Env>>(ConfigService);

  applyHelmet(app, configService.get('SITE_URL', { infer: true }) ?? 'http://localhost:3001');

  const corsOrigins = configService.get<string>('CORS_ORIGINS', { infer: true }) ?? '*';
  app.enableCors({
    origin: corsOrigins === '*' ? '*' : corsOrigins.split(','),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Kast-Key'],
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const httpAdapterHost = app.get<HttpAdapterHost>(HttpAdapterHost);

  // Wire up Sentry error reporting if DSN is configured
  const sentryDsn = configService.get<string>('SENTRY_DSN', { infer: true });
  let sentryReporter: ((err: unknown, ctx: Record<string, string>) => void) | undefined;
  if (sentryDsn) {
    interface SentryModule {
      init(opts: { dsn: string; environment: string; tracesSampleRate: number }): void;
      captureException(err: unknown, ctx?: { extra?: Record<string, string> }): void;
    }
    try {
      // @ts-ignore -- @sentry/node is an optional peer dependency
      const Sentry = (await import('@sentry/node')) as unknown as SentryModule;
      const sentryEnv =
        configService.get<string>('SENTRY_ENVIRONMENT', { infer: true }) ?? 'production';
      const sentrySampleRate = Number(
        configService.get('SENTRY_TRACES_SAMPLE_RATE', { infer: true }) ?? 0.1,
      );
      Sentry.init({ dsn: sentryDsn, environment: sentryEnv, tracesSampleRate: sentrySampleRate });
      sentryReporter = (err, ctx) => Sentry.captureException(err, { extra: ctx });
    } catch {
      // @sentry/node is optional — skip silently
    }
  }

  app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost, sentryReporter));

  const nodeEnv = configService.get<string>('NODE_ENV', { infer: true });
  if (nodeEnv !== 'production') {
    applySwagger(app);
  }

  const port: number =
    (configService.get<number>('PORT', { infer: true }) as number | undefined) ?? 3000;
  await app.listen(port);
}

void bootstrap();

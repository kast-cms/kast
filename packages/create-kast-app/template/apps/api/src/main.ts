import { Logger, ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { assertNoKnownWeakCredentials } from './common/utils/weak-credential.util';
import { originOf, parseTrustProxy } from './config/bootstrap.util';
import type { Env } from './config/env.schema';
import { PrismaService } from './prisma/prisma.service';

function applyHelmet(app: INestApplication, siteUrl: string, adminUrl: string): void {
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
          // The admin panel embeds the Bull board from this origin, so its
          // origin must be allowed to frame us; everything else stays blocked.
          frameAncestors: ["'self'", originOf(adminUrl), originOf(siteUrl)],
          upgradeInsecureRequests: [],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xContentTypeOptions: true,
      // frame-ancestors above is the modern, per-origin control. X-Frame-Options
      // cannot express an allow-list, and 'deny' would override it in browsers
      // that honour both, blocking the admin's queue monitor outright.
      xFrameOptions: false,
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

type SentryReporter = (err: unknown, ctx: Record<string, string>) => void;

interface SentryModule {
  init(opts: { dsn: string; environment: string; tracesSampleRate: number }): void;
  captureException(err: unknown, ctx?: { extra?: Record<string, string> }): void;
}

/** Wires up Sentry when a DSN is configured; @sentry/node is optional. */
async function buildSentryReporter(
  configService: ConfigService<Env>,
): Promise<SentryReporter | undefined> {
  const dsn = configService.get<string>('SENTRY_DSN', { infer: true });
  if (!dsn) return undefined;
  try {
    // @ts-ignore -- @sentry/node is an optional peer dependency
    const Sentry = (await import('@sentry/node')) as unknown as SentryModule;
    Sentry.init({
      dsn,
      environment: configService.get<string>('SENTRY_ENVIRONMENT', { infer: true }) ?? 'production',
      tracesSampleRate: Number(
        configService.get('SENTRY_TRACES_SAMPLE_RATE', { infer: true }) ?? 0.1,
      ),
    });
    return (err, ctx) => Sentry.captureException(err, { extra: ctx });
  } catch {
    return undefined;
  }
}

async function bootstrap(): Promise<void> {
  // Typed as the Express app so `trust proxy` can be set below.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  const configService = app.get<ConfigService<Env>>(ConfigService);

  applyHelmet(
    app,
    configService.get('SITE_URL', { infer: true }) ?? 'http://localhost:3000',
    configService.get('ADMIN_URL', { infer: true }) ?? 'http://localhost:3001/admin',
  );

  // Decides what `req.ip` means: the address recorded against a public form
  // submission and the key the throttler counts on both read it.
  app.set('trust proxy', parseTrustProxy(configService.get('TRUST_PROXY', { infer: true }) ?? ''));

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

  const sentryReporter = await buildSentryReporter(configService);

  app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost, sentryReporter));

  const nodeEnv = configService.get<string>('NODE_ENV', { infer: true });
  if (nodeEnv !== 'production') {
    applySwagger(app);
  }

  // P0-05: a database seeded before the seed-script guard (or restored from an
  // old dump) can still hold a publicly documented super-admin password. Fatal
  // unless this install explicitly opted into those logins — NODE_ENV is not
  // trusted on its own, since deployments routinely inherit `development` from a
  // copied .env.
  await assertNoKnownWeakCredentials(
    app.get(PrismaService).user,
    {
      NODE_ENV: nodeEnv,
      SEED_DEV_ACCOUNTS: configService.get<string>('SEED_DEV_ACCOUNTS', { infer: true }),
    },
    new Logger('CredentialCheck'),
  );

  const port: number =
    (configService.get<number>('PORT', { infer: true }) as number | undefined) ?? 3000;
  await app.listen(port);
}

void bootstrap();

/**
 * Boots the real Nest application for e2e tests, applying the SAME global
 * prefix, URI versioning, validation pipe and exception filter that
 * `src/main.ts` configures at runtime — without importing main.ts (which would
 * call bootstrap()/listen()). Keep this in sync with main.ts.
 */
import { ValidationPipe, VersioningType, type INestApplication } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Server } from 'http';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import request = require('supertest');

export const ADMIN_EMAIL = 'admin@kast.local';
export const ADMIN_PASSWORD = 'Admin1234!';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();

  // Mirror src/main.ts global configuration.
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
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new GlobalExceptionFilter(httpAdapterHost));

  await app.init();
  return app;
}

export function httpServer(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}

interface LoginResponseBody {
  accessToken: string;
  refreshToken: string;
  user: { id: string; roles: string[] };
}

export async function login(
  app: INestApplication,
  email = ADMIN_EMAIL,
  password = ADMIN_PASSWORD,
): Promise<LoginResponseBody> {
  const res = await request(httpServer(app))
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  // Controllers wrap successful payloads in { data: ... }.
  return (res.body as { data: LoginResponseBody }).data;
}

export async function adminToken(app: INestApplication): Promise<string> {
  const { accessToken } = await login(app);
  return accessToken;
}

/** Authorization header helper. */
export function bearer(token: string): [string, string] {
  return ['Authorization', `Bearer ${token}`];
}

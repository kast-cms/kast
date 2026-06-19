import type { INestApplication } from '@nestjs/common';
import { ADMIN_EMAIL, bearer, createTestApp, httpServer, login } from './test-app';
import request = require('supertest');

describe('Health & Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/health', () => {
    it('reports the service as up (public)', async () => {
      const res = await request(httpServer(app)).get('/api/v1/health').expect(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.info?.database?.status).toBe('up');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns a token pair for valid admin credentials', async () => {
      const res = await request(httpServer(app))
        .post('/api/v1/auth/login')
        .send({ email: ADMIN_EMAIL, password: 'Admin1234!' })
        .expect(200);
      expect(typeof res.body.data.accessToken).toBe('string');
      expect(typeof res.body.data.refreshToken).toBe('string');
      expect(res.body.data.user.roles).toContain('super_admin');
    });

    it('rejects a wrong password with 401 and the error envelope', async () => {
      const res = await request(httpServer(app))
        .post('/api/v1/auth/login')
        .send({ email: ADMIN_EMAIL, password: 'WrongPassword!' })
        .expect(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.statusCode).toBe(401);
    });

    it('rejects a malformed body (missing password) with 400 validation error', async () => {
      const res = await request(httpServer(app))
        .post('/api/v1/auth/login')
        .send({ email: ADMIN_EMAIL })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects a non-email value with 400', async () => {
      await request(httpServer(app))
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'x' })
        .expect(400);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns the current user when authenticated', async () => {
      const { accessToken } = await login(app);
      const res = await request(httpServer(app))
        .get('/api/v1/auth/me')
        .set(...bearer(accessToken))
        .expect(200);
      expect(res.body.data.email).toBe(ADMIN_EMAIL);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(httpServer(app)).get('/api/v1/auth/me').expect(401);
    });

    it('rejects a garbage bearer token with 401', async () => {
      await request(httpServer(app))
        .get('/api/v1/auth/me')
        .set(...bearer('not.a.real.token'))
        .expect(401);
    });
  });

  describe('auth rate limiting', () => {
    it('eventually returns 429 with a RATE_LIMITED envelope under a burst of logins', async () => {
      // The login route is throttled (auth bucket, 20 / 15 min). Fire enough
      // wrong-password attempts to trip it and assert the 429 response shape.
      let rateLimited = false;
      for (let i = 0; i < 40; i++) {
        const res = await request(httpServer(app))
          .post('/api/v1/auth/login')
          .send({ email: `burst${i}@kast.local`, password: 'nope' });
        if (res.status === 429) {
          expect(res.body.error.code).toBe('RATE_LIMITED');
          rateLimited = true;
          break;
        }
      }
      expect(rateLimited).toBe(true);
    });
  });
});

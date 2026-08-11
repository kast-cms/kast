/**
 * P0-06 end-to-end: secret settings are encrypted at rest and never returned.
 *
 * The unit suite proves the service's projection; this proves the whole HTTP
 * chain — controller role decorators, the service projection, and the stored
 * ciphertext — against a real database, which is where an SMTP password was
 * previously readable by any VIEWER.
 */
import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { adminToken, bearer, createTestApp, httpServer, login } from './test-app';
import request = require('supertest');

interface SafeSetting {
  key: string;
  value: unknown;
  isSecret?: boolean;
  configured?: boolean;
}

const SECRET_KEY = 'smtp.password';
const SECRET_VALUE = 'super-secret-smtp-pw';

describe('Settings secrets (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminJwt: string;
  let viewerJwt: string;

  async function getSettings(jwt: string): Promise<{ raw: string; items: SafeSetting[] }> {
    const res = await request(httpServer(app))
      .get('/api/v1/settings')
      .set(...bearer(jwt))
      .expect(200);
    return { raw: JSON.stringify(res.body), items: (res.body as { data: SafeSetting[] }).data };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    adminJwt = await adminToken(app);

    // A viewer is the principal the finding was about: the role with the least
    // privilege that could still read the plaintext password.
    const viewerRole = await prisma.role.findUnique({ where: { name: 'viewer' } });
    const argon2 = await import('argon2');
    const viewer = await prisma.user.create({
      data: {
        email: `settings-viewer-${Date.now()}@kast.local`,
        firstName: 'Settings',
        lastName: 'Viewer',
        passwordHash: await argon2.hash('Viewer1234!', { type: argon2.argon2id }),
        isActive: true,
        ...(viewerRole ? { roles: { create: { roleId: viewerRole.id } } } : {}),
      },
    });
    viewerJwt = (await login(app, viewer.email, 'Viewer1234!')).accessToken;

    await request(httpServer(app))
      .patch('/api/v1/settings')
      .set(...bearer(adminJwt))
      .send({ settings: [{ key: SECRET_KEY, value: SECRET_VALUE }] })
      .expect(200);
  });

  afterAll(async () => {
    await prisma.globalSetting.deleteMany({ where: { key: SECRET_KEY } });
    await app.close();
  });

  it('stores the secret encrypted, not as plaintext', async () => {
    const row = await prisma.globalSetting.findUnique({ where: { key: SECRET_KEY } });

    expect(row).not.toBeNull();
    expect(JSON.stringify(row?.value)).toContain('enc:v1:');
    expect(JSON.stringify(row?.value)).not.toContain(SECRET_VALUE);
  });

  it('never marks a secret setting public', async () => {
    const row = await prisma.globalSetting.findUnique({ where: { key: SECRET_KEY } });

    expect(row?.isPublic).toBe(false);
  });

  it('does not echo the plaintext back on the PATCH response', async () => {
    const res = await request(httpServer(app))
      .patch('/api/v1/settings')
      .set(...bearer(adminJwt))
      .send({ settings: [{ key: SECRET_KEY, value: SECRET_VALUE }] })
      .expect(200);

    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(SECRET_VALUE);
    expect(raw).not.toContain('enc:v1:');
  });

  it('withholds the secret row entirely from a viewer', async () => {
    const { raw, items } = await getSettings(viewerJwt);

    expect(items.find((s) => s.key === SECRET_KEY)).toBeUndefined();
    expect(raw).not.toContain(SECRET_VALUE);
    expect(raw).not.toContain('enc:v1:');
  });

  it('shows an admin that the secret is configured but not its value', async () => {
    const { raw, items } = await getSettings(adminJwt);
    const secret = items.find((s) => s.key === SECRET_KEY);

    expect(secret).toMatchObject({ value: null, isSecret: true, configured: true });
    expect(raw).not.toContain(SECRET_VALUE);
    expect(raw).not.toContain('enc:v1:');
  });

  it('keeps the secret out of the anonymous public settings payload', async () => {
    const res = await request(httpServer(app)).get('/api/v1/delivery/settings').expect(200);

    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(SECRET_VALUE);
    expect(raw).not.toContain(SECRET_KEY);
  });

  it('still requires authentication on the management settings route', async () => {
    await request(httpServer(app)).get('/api/v1/settings').expect(401);
  });

  it('refuses a secret write from a non-super_admin', async () => {
    await request(httpServer(app))
      .patch('/api/v1/settings')
      .set(...bearer(viewerJwt))
      .send({ settings: [{ key: SECRET_KEY, value: 'attacker-set' }] })
      .expect(403);
  });
});

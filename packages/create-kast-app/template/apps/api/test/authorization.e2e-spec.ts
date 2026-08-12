/**
 * End-to-end authorization matrix for the token layer (P0-02 / P0-03).
 *
 * Every token here is minted through the real API with an admin JWT, so this
 * exercises the whole chain: strategy -> TokenPolicyGuard -> RolesGuard.
 */
import type { INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../src/prisma/prisma.service';
import { adminToken, bearer, createTestApp, httpServer, login } from './test-app';
import request = require('supertest');

interface CreatedApiToken {
  id: string;
  token: string;
}

async function mintApiToken(
  app: INestApplication,
  jwt: string,
  body: Record<string, unknown>,
): Promise<CreatedApiToken> {
  const res = await request(httpServer(app))
    .post('/api/v1/tokens')
    .set(...bearer(jwt))
    .send(body)
    .expect(201);
  const data = (res.body as { data: CreatedApiToken }).data;
  return data;
}

async function mintAgentToken(
  app: INestApplication,
  jwt: string,
  scopes: string[],
): Promise<CreatedApiToken> {
  const res = await request(httpServer(app))
    .post('/api/v1/agent-tokens')
    .set(...bearer(jwt))
    .send({ name: `e2e-agent-${Date.now()}`, scopes })
    .expect(201);
  const data = (res.body as { data: { token: string; record: { id: string } } }).data;
  return { id: data.record.id, token: data.token };
}

function withKey(token: string): [string, string] {
  return ['X-Kast-Key', token];
}

describe('Authorization matrix (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: string;
  const createdTokenIds: string[] = [];
  const createdAgentTokenIds: string[] = [];
  const createdUserIds: string[] = [];
  let customRoleId: string | undefined;
  // Created here rather than assumed from seed data, so a 404 can never be
  // mistaken for the guard allowing or denying a request.
  const typeName = `authz-fixture-${Date.now()}`;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwt = await adminToken(app);
    await request(httpServer(app))
      .post('/api/v1/content-types')
      .set(...bearer(jwt))
      .send({ name: typeName, displayName: 'Authz Fixture' })
      .expect(201);
  });

  afterAll(async () => {
    for (const id of createdTokenIds) {
      await request(httpServer(app))
        .delete(`/api/v1/tokens/${id}`)
        .set(...bearer(jwt));
    }
    for (const id of createdAgentTokenIds) {
      await request(httpServer(app))
        .delete(`/api/v1/agent-tokens/${id}`)
        .set(...bearer(jwt));
    }
    await request(httpServer(app))
      .delete(`/api/v1/content-types/${typeName}`)
      .set(...bearer(jwt));
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (customRoleId) {
      await prisma.role.delete({ where: { id: customRoleId } });
    }
    await app.close();
  });

  async function createUserWithRole(
    roleName: string,
    label: string,
  ): Promise<{
    id: string;
    email: string;
    password: string;
    accessToken: string;
    refreshToken: string;
  }> {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    const email = `authz-${label}-${Date.now()}@kast.local`;
    const password = 'Writer1234!';
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        firstName: 'Authz',
        lastName: label,
        isActive: true,
        isVerified: true,
        roles: { create: [{ roleId: role.id }] },
      },
    });
    createdUserIds.push(user.id);
    const session = await login(app, email, password);
    return { id: user.id, email, password, ...session };
  }

  describe('READ_ONLY API token', () => {
    let token: string;

    beforeAll(async () => {
      const created = await mintApiToken(app, jwt, {
        name: 'e2e-read-only',
        scope: 'READ_ONLY',
      });
      token = created.token;
      createdTokenIds.push(created.id);
    });

    it('allows a GET on a management read route', async () => {
      await request(httpServer(app))
        .get('/api/v1/content-types')
        .set(...withKey(token))
        .expect(200);
    });

    it('refuses POST', async () => {
      await request(httpServer(app))
        .post('/api/v1/content-types')
        .set(...withKey(token))
        .send({ name: 'ro-should-not-exist', displayName: 'Nope' })
        .expect(403);
    });

    it('refuses DELETE', async () => {
      await request(httpServer(app))
        .delete('/api/v1/content-types/anything')
        .set(...withKey(token))
        .expect(403);
    });
  });

  describe('SCOPED API token limited to content:read', () => {
    let token: string;

    beforeAll(async () => {
      const created = await mintApiToken(app, jwt, {
        name: 'e2e-scoped',
        scope: 'SCOPED',
        // Entry routes carry a content-type scope; a bare `content` key is a
        // legacy grant that deliberately does not widen to every type.
        scopeData: { 'content:*': ['read'] },
      });
      token = created.token;
      createdTokenIds.push(created.id);
    });

    it('allows the granted resource:action', async () => {
      await request(httpServer(app))
        .get(`/api/v1/content-types/${typeName}/entries`)
        .set(...withKey(token))
        .expect(200);
    });

    it('refuses a resource it was not granted', async () => {
      await request(httpServer(app))
        .get('/api/v1/media')
        .set(...withKey(token))
        .expect(403);
    });

    it('refuses a mutation on the granted resource', async () => {
      await request(httpServer(app))
        .post(`/api/v1/content-types/${typeName}/entries`)
        .set(...withKey(token))
        .send({ locale: 'en', data: {} })
        .expect(403);
    });

    it('refuses the MCP transport', async () => {
      await request(httpServer(app))
        .post('/api/v1/mcp')
        .set(...withKey(token))
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
        .expect(403);
    });
  });

  describe('FULL_ACCESS API token', () => {
    let token: string;

    beforeAll(async () => {
      const created = await mintApiToken(app, jwt, {
        name: 'e2e-full-access',
        scope: 'FULL_ACCESS',
      });
      token = created.token;
      createdTokenIds.push(created.id);
    });

    it('reads a management route', async () => {
      await request(httpServer(app))
        .get('/api/v1/content-types')
        .set(...withKey(token))
        .expect(200);
    });

    it('is not blocked by the token policy on a write', async () => {
      // Any status other than 403 proves TokenPolicyGuard let it through; the
      // request itself may still legitimately 400 on payload validation.
      const res = await request(httpServer(app))
        .post('/api/v1/content-types')
        .set(...withKey(token))
        .send({});
      expect(res.status).not.toBe(403);
    });
  });

  describe('expired API token', () => {
    it('is rejected with 401', async () => {
      const created = await mintApiToken(app, jwt, {
        name: 'e2e-expired',
        scope: 'FULL_ACCESS',
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      });
      createdTokenIds.push(created.id);

      await request(httpServer(app))
        .get('/api/v1/content-types')
        .set(...withKey(created.token))
        .expect(401);
    });
  });

  describe('agent token', () => {
    let token: string;

    beforeAll(async () => {
      const created = await mintAgentToken(app, jwt, ['list_content_entries']);
      token = created.token;
      createdAgentTokenIds.push(created.id);
    });

    it('reaches the MCP transport', async () => {
      const res = await request(httpServer(app))
        .post('/api/v1/mcp')
        .set(...bearer(token))
        // Streamable HTTP requires clients to accept both content types, and
        // the transport may answer with either one — buffer the raw payload.
        .set('Accept', 'application/json, text/event-stream')
        .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
        .buffer(true)
        .parse((response, cb) => {
          let text = '';
          response.on('data', (chunk: Buffer) => (text += chunk.toString()));
          response.on('end', () => cb(null, text));
        })
        .expect(200);

      const raw = res.body as string;
      const sseData = /^data: (.+)$/m.exec(raw);
      const payload = JSON.parse(sseData?.[1] ?? raw) as Record<string, unknown>;
      expect(payload).toMatchObject({ jsonrpc: '2.0', id: 1 });
    });

    it.each([
      ['GET', '/api/v1/content-types'],
      ['GET', '/api/v1/media'],
      ['GET', '/api/v1/settings'],
      ['GET', '/api/v1/agent-tokens'],
      ['POST', '/api/v1/tokens'],
      ['GET', '/api/v1/users'],
    ])('is refused on %s %s', async (method, path) => {
      const req = request(httpServer(app));
      const call = method === 'POST' ? req.post(path) : req.get(path);
      await call.set(...bearer(token)).expect(403);
    });
  });

  /**
   * The whole guard layer (RolesGuard + the new permission resolver) was
   * rewritten, and every management read route was closed at the same time. A
   * super_admin short-circuits the guard on its first branch, so it proves very
   * little. This block exercises the account the admin panel's own non-owner
   * users have — a plain EDITOR — over the routes the admin actually calls.
   */
  describe('editor JWT (the admin panel’s day-to-day principal)', () => {
    let editorJwt: string;
    let entryId: string;

    beforeAll(async () => {
      editorJwt = (await createUserWithRole('editor', 'editor')).accessToken;
    });

    it.each([
      ['/api/v1/content-types'],
      ['/api/v1/media'],
      [`/api/v1/content-types/${typeName}/entries`],
    ])('can read %s', async (path) => {
      await request(httpServer(app))
        .get(path)
        .set(...bearer(editorJwt))
        .expect(200);
    });

    it('can create an entry of the fixture type', async () => {
      const res = await request(httpServer(app))
        .post(`/api/v1/content-types/${typeName}/entries`)
        .set(...bearer(editorJwt))
        .send({ locale: 'en', data: { slug: `editor-entry-${Date.now().toString()}` } })
        .expect(201);
      entryId = (res.body as { data: { id: string } }).data.id;
      expect(entryId).toEqual(expect.any(String));
    });

    it('can update the entry it created', async () => {
      await request(httpServer(app))
        .patch(`/api/v1/content-types/${typeName}/entries/${entryId}`)
        .set(...bearer(editorJwt))
        .send({ locale: 'en', data: { slug: `editor-entry-updated-${Date.now().toString()}` } })
        .expect(200);
    });

    it('is still refused on an admin-only route', async () => {
      await request(httpServer(app))
        .get('/api/v1/users')
        .set(...bearer(editorJwt))
        .expect(403);
    });

    it('is still refused on a super_admin-only settings write', async () => {
      await request(httpServer(app))
        .patch('/api/v1/settings')
        .set(...bearer(editorJwt))
        .send({ settings: [{ key: 'site_name', value: 'nope' }] })
        .expect(403);
    });
  });

  describe('viewer JWT', () => {
    let viewerJwt: string;

    beforeAll(async () => {
      viewerJwt = (await createUserWithRole('viewer', 'viewer')).accessToken;
    });

    it.each(['/api/v1/content-types', '/api/v1/media', '/api/v1/settings'])(
      'can read %s',
      async (path) => {
        await request(httpServer(app))
          .get(path)
          .set(...bearer(viewerJwt))
          .expect(200);
      },
    );

    it('cannot create content types', async () => {
      await request(httpServer(app))
        .post('/api/v1/content-types')
        .set(...bearer(viewerJwt))
        .send({ name: 'viewer-cannot-create', displayName: 'Nope' })
        .expect(403);
    });

    it('cannot read the user administration API', async () => {
      await request(httpServer(app))
        .get('/api/v1/users')
        .set(...bearer(viewerJwt))
        .expect(403);
    });
  });

  describe('admin JWT', () => {
    let adminJwt: string;
    let adminUserId: string;

    beforeAll(async () => {
      const session = await createUserWithRole('admin', 'admin');
      adminJwt = session.accessToken;
      adminUserId = session.id;
    });

    it.each(['/api/v1/users', '/api/v1/audit', '/api/v1/plugins'])('can read %s', async (path) => {
      await request(httpServer(app))
        .get(path)
        .set(...bearer(adminJwt))
        .expect(200);
    });

    it('cannot perform a super-admin-only settings write', async () => {
      await request(httpServer(app))
        .patch('/api/v1/settings')
        .set(...bearer(adminJwt))
        .send({ settings: [{ key: 'site_name', value: 'nope' }] })
        .expect(403);
    });

    it('uses current database roles rather than stale JWT role claims', async () => {
      const viewerRole = await prisma.role.findUniqueOrThrow({ where: { name: 'viewer' } });
      await prisma.userRole.deleteMany({ where: { userId: adminUserId } });
      await prisma.userRole.create({ data: { userId: adminUserId, roleId: viewerRole.id } });

      await request(httpServer(app))
        .get('/api/v1/users')
        .set(...bearer(adminJwt))
        .expect(403);
      await request(httpServer(app))
        .get('/api/v1/content-types')
        .set(...bearer(adminJwt))
        .expect(200);
    });
  });

  describe('custom-role permissions', () => {
    let customJwt: string;

    beforeAll(async () => {
      const roleName = `content-reader-${Date.now()}`;
      const created = await request(httpServer(app))
        .post('/api/v1/roles')
        .set(...bearer(jwt))
        .send({ name: roleName, displayName: 'Content Reader' })
        .expect(201);
      customRoleId = (created.body as { data: { id: string } }).data.id;

      await request(httpServer(app))
        .post(`/api/v1/roles/${customRoleId}/permissions`)
        .set(...bearer(jwt))
        .send({ permissions: [{ resource: 'content-types', action: 'read', scope: '*' }] })
        .expect(200);

      customJwt = (await createUserWithRole(roleName, 'custom-role')).accessToken;
    });

    it('allows an explicitly granted resource and action', async () => {
      await request(httpServer(app))
        .get('/api/v1/content-types')
        .set(...bearer(customJwt))
        .expect(200);
    });

    it('denies ungranted actions and resources', async () => {
      await request(httpServer(app))
        .post('/api/v1/content-types')
        .set(...bearer(customJwt))
        .send({ name: 'custom-cannot-create', displayName: 'Nope' })
        .expect(403);
      await request(httpServer(app))
        .get('/api/v1/media')
        .set(...bearer(customJwt))
        .expect(403);
    });

    it('applies permission revocation immediately to an existing JWT', async () => {
      await request(httpServer(app))
        .post(`/api/v1/roles/${customRoleId}/permissions`)
        .set(...bearer(jwt))
        .send({ permissions: [] })
        .expect(200);

      await request(httpServer(app))
        .get('/api/v1/content-types')
        .set(...bearer(customJwt))
        .expect(403);
    });
  });

  describe('inactive user', () => {
    let inactive: Awaited<ReturnType<typeof createUserWithRole>>;

    beforeAll(async () => {
      inactive = await createUserWithRole('viewer', 'inactive');
      await prisma.user.update({ where: { id: inactive.id }, data: { isActive: false } });
    });

    it('rejects an access token minted before deactivation', async () => {
      await request(httpServer(app))
        .get('/api/v1/content-types')
        .set(...bearer(inactive.accessToken))
        .expect(401);
    });

    it('rejects refresh after deactivation', async () => {
      await request(httpServer(app))
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: inactive.refreshToken })
        .expect(401);
    });

    it('rejects a new login', async () => {
      await request(httpServer(app))
        .post('/api/v1/auth/login')
        .send({ email: inactive.email, password: inactive.password })
        .expect(401);
    });
  });

  describe('anonymous access to management routes', () => {
    it.each([
      ['/api/v1/content-types'],
      ['/api/v1/media'],
      ['/api/v1/settings'],
      ['/api/v1/menus/main'],
      ['/api/v1/search?q=test'],
    ])('%s returns 401 without a credential', async (path) => {
      await request(httpServer(app)).get(path).expect(401);
    });
  });
});

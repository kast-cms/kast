/**
 * AUTH-01 end-to-end: first-owner creation is serialised by a database-level
 * advisory lock, so concurrent POST /api/v1/auth/setup calls cannot mint two
 * super-admins.
 *
 * The unit suite (auth-setup-concurrency.spec.ts) stubs the repository, so it
 * only proves the in-process promise chain. The authoritative guard is
 * `pg_advisory_xact_lock` inside `createInitialOwner`, and that can only be
 * exercised against real PostgreSQL — which is what this spec does.
 *
 * It is inherently destructive: the setup route only runs when the users table
 * is empty, and by then other suites may already have created rows that
 * reference the seeded admin (content entries carry `createdById`), so a plain
 * `user.deleteMany()` would hit a foreign key. Jest schedules suites by its own
 * heuristic rather than alphabetically, so this suite must not depend on where
 * it lands in the order.
 *
 * It therefore runs the very same `globalSetup` routine the e2e run starts from,
 * both before (to reach a known-empty state) and after (to hand the next suite a
 * database indistinguishable from a fresh run). `jest-e2e.json` pins
 * `maxWorkers: 1`, so no other suite is live while that happens, and every other
 * suite logs in during its own `beforeAll`, so a new admin row id is invisible
 * to them.
 */
import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import globalSetup from './global-setup';
import { createTestApp, httpServer, login } from './test-app';
import request = require('supertest');

// POST /auth/setup is throttled to 5 requests / 15 min per IP, and every
// supertest call in this file shares one IP. Four concurrent attempts still
// demonstrate the race while leaving exactly one request of budget for the
// "later attempt" case below — the throttler is real behaviour and is left on.
const CONCURRENT_ATTEMPTS = 4;

describe('First-owner setup race (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    // Truncate + reseed roles/locales/settings/admin, whatever earlier suites
    // left behind, then clear users so the setup route becomes reachable.
    await globalSetup();
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
    // Hand the next suite the same starting state the run began with.
    await globalSetup();
  });

  it('creates exactly one owner when several setup calls race', async () => {
    // Distinct emails on purpose: a shared address would be stopped by the
    // User.email unique constraint, which would mask a missing lock.
    const responses = await Promise.all(
      Array.from({ length: CONCURRENT_ATTEMPTS }, (_, i) =>
        request(httpServer(app))
          .post('/api/v1/auth/setup')
          .send({
            email: `owner-${i.toString()}@kast.local`,
            password: 'FirstOwner1234!',
            firstName: 'First',
            lastName: 'Owner',
          }),
      ),
    );

    const created = responses.filter((r) => r.status === 201);
    const refused = responses.filter((r) => r.status === 403);

    // Surfaced explicitly: a 429 or 500 here would otherwise look like a pass.
    expect(responses.map((r) => r.status).sort()).toEqual([201, 403, 403, 403]);
    expect(created).toHaveLength(1);
    expect(refused).toHaveLength(CONCURRENT_ATTEMPTS - 1);
  });

  it('leaves exactly one user in the database', async () => {
    expect(await prisma.user.count()).toBe(1);
  });

  it('gives that single owner the super_admin role', async () => {
    const owner = await prisma.user.findFirstOrThrow({
      include: { roles: { include: { role: true } } },
    });

    expect(owner.roles.map((r) => r.role.name)).toEqual(['super_admin']);
  });

  it('refuses a later setup attempt now that an owner exists', async () => {
    await request(httpServer(app))
      .post('/api/v1/auth/setup')
      .send({
        email: 'late-comer@kast.local',
        password: 'FirstOwner1234!',
        firstName: 'Late',
        lastName: 'Comer',
      })
      .expect(403);

    expect(await prisma.user.count()).toBe(1);
  });

  it('lets the owner that was created actually log in', async () => {
    const owner = await prisma.user.findFirstOrThrow();
    const { accessToken, user } = await login(app, owner.email, 'FirstOwner1234!');

    expect(accessToken).toEqual(expect.any(String));
    expect(user.roles).toContain('super_admin');
  });
});

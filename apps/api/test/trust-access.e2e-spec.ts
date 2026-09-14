import type { INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { generateSync } from 'otplib';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer, createTestApp, httpServer, login } from './test-app';
import request = require('supertest');

describe('Trust and access (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  const email = `trust-${randomUUID()}@example.com`;
  const password = 'Trust-test-password-123!';

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await argon2.hash(password),
        isActive: true,
        roles: { create: { role: { connect: { name: 'super_admin' } } } },
      },
    });
    userId = user.id;
  });
  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  it('enforces MFA for passwords and OAuth, consumes codes once, and revokes access immediately', async () => {
    const server = httpServer(app);
    const primary = async (): Promise<request.Response> =>
      request(server).post('/api/v1/auth/login').send({ email, password }).expect(200);
    const first = (await primary()).body.data;
    const oldDevice = (await primary()).body.data;
    const setup = await request(server)
      .post('/api/v1/auth/two-factor/setup')
      .set(...bearer(first.accessToken))
      .expect(201);
    const secret = setup.body.data.secret as string;
    expect(setup.body.data.qrCode).toMatch(/^data:image\/png;base64,/);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).twoFactorSecret,
    ).not.toBe(secret);
    const enabled = await request(server)
      .post('/api/v1/auth/two-factor/enable')
      .set(...bearer(first.accessToken))
      .send({ code: generateSync({ secret }) })
      .expect(201);
    const codes = enabled.body.data.recoveryCodes as string[];
    expect(codes).toHaveLength(10);
    await request(server)
      .get('/api/v1/auth/me')
      .set(...bearer(oldDevice.accessToken))
      .expect(401);
    await request(server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldDevice.refreshToken })
      .expect(401);

    const pending = (await primary()).body.data;
    expect(pending.requiresTwoFactor).toBe(true);
    expect(pending.accessToken).toBeUndefined();
    expect(pending.refreshToken).toBeUndefined();
    await request(server)
      .get('/api/v1/auth/me')
      .set(...bearer(pending.challengeToken))
      .expect(401);
    await request(server)
      .post('/api/v1/auth/two-factor/verify')
      .send({ challengeToken: pending.challengeToken, code: 'invalid-code' })
      .expect(401);
    await request(server)
      .post('/api/v1/auth/two-factor/verify')
      .send({ challengeToken: pending.challengeToken, code: codes[0] })
      .expect(401);

    const secondChallenge = (await primary()).body.data.challengeToken;
    const second = (
      await request(server)
        .post('/api/v1/auth/two-factor/verify')
        .send({ challengeToken: secondChallenge, code: codes[0] })
        .expect(200)
    ).body.data;
    const replayChallenge = (await primary()).body.data.challengeToken;
    await request(server)
      .post('/api/v1/auth/two-factor/verify')
      .send({ challengeToken: replayChallenge, code: codes[0] })
      .expect(401);

    const oauth = await app
      .get(AuthService)
      .oauthCallback('oidc:https://issuer.example', {
        id: 'subject',
        provider: 'oidc',
        emails: [{ value: email, verified: true }],
      });
    expect(oauth).toHaveProperty('requiresTwoFactor', true);
    expect(oauth).not.toHaveProperty('accessToken');
    const oauthCode = await app.get(AuthService).issueOAuthAuthorizationCode(oauth);
    const exchanged = (
      await request(server)
        .post('/api/v1/auth/oauth/exchange')
        .send({ code: oauthCode })
        .expect(200)
    ).body.data;
    await request(server)
      .post('/api/v1/auth/two-factor/verify')
      .send({ challengeToken: exchanged.challengeToken, code: codes[1] })
      .expect(200);

    const challenges = await Promise.all([primary(), primary()]);
    const raced = await Promise.all(
      challenges.map((response) =>
        request(server)
          .post('/api/v1/auth/two-factor/verify')
          .send({ challengeToken: response.body.data.challengeToken, code: codes[2] }),
      ),
    );
    expect(raced.map((response) => response.status).sort()).toEqual([200, 401]);

    const devices = (
      await request(server)
        .get('/api/v1/auth/sessions')
        .set(...bearer(first.accessToken))
        .expect(200)
    ).body.data;
    expect(devices.filter((device: { current: boolean }) => device.current)).toHaveLength(1);
    expect(JSON.stringify(devices)).not.toContain('tokenHash');
    const rotated = await Promise.all(
      [1, 2].map(() =>
        request(server).post('/api/v1/auth/refresh').send({ refreshToken: second.refreshToken }),
      ),
    );
    expect(rotated.map((response) => response.status).sort()).toEqual([200, 401]);
    const winner = rotated.find((response) => response.status === 200)?.body.data;
    const secondDevices = (
      await request(server)
        .get('/api/v1/auth/sessions')
        .set(...bearer(winner.accessToken))
        .expect(200)
    ).body.data;
    const secondId = secondDevices.find((device: { current: boolean }) => device.current).id;
    const otherUser = await login(app);
    await request(server)
      .delete(`/api/v1/auth/sessions/${secondId}`)
      .set(...bearer(otherUser.accessToken))
      .expect(200);
    await request(server)
      .get('/api/v1/auth/me')
      .set(...bearer(winner.accessToken))
      .expect(200);
    await request(server)
      .delete(`/api/v1/auth/sessions/${secondId}`)
      .set(...bearer(first.accessToken))
      .expect(200);
    await request(server)
      .get('/api/v1/auth/me')
      .set(...bearer(winner.accessToken))
      .expect(401);
    await request(server)
      .get('/api/v1/auth/me')
      .set(...bearer(second.accessToken))
      .expect(401);

    const replacement = await request(server)
      .post('/api/v1/auth/two-factor/recovery-codes')
      .set(...bearer(first.accessToken))
      .send({ code: codes[3] })
      .expect(201);
    expect(replacement.body.data.recoveryCodes).toHaveLength(10);
    const stale = (await primary()).body.data.challengeToken;
    await request(server)
      .post('/api/v1/auth/two-factor/verify')
      .send({ challengeToken: stale, code: codes[4] })
      .expect(401);
    await request(server)
      .post('/api/v1/auth/two-factor/disable')
      .set(...bearer(first.accessToken))
      .send({ code: replacement.body.data.recoveryCodes[0] })
      .expect(201);
    expect((await primary()).body.data.accessToken).toEqual(expect.any(String));
    await request(server)
      .delete('/api/v1/auth/sessions')
      .set(...bearer(first.accessToken))
      .expect(200);
    await request(server)
      .get('/api/v1/auth/me')
      .set(...bearer(first.accessToken))
      .expect(401);
  });
});

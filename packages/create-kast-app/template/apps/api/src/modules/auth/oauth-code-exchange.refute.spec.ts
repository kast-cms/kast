import {
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import type { TokenPair } from '../../common/types/auth.types';
import type { Env } from '../../config/env.schema';
import type { QueueAdapter } from '../queue/queue.adapter';
import { AuthController } from './auth.controller';
import type { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import type { OAuthPolicy } from './oauth-policy';

function buildTokenPair(): TokenPair {
  return {
    accessToken: 'access-jwt',
    refreshToken: 'refresh-raw-secret',
    expiresIn: 900,
    user: {
      id: 'u1',
      email: 'admin@kast.local',
      firstName: 'Kast',
      lastName: 'Admin',
      avatarUrl: null,
      roles: ['editor'],
    },
  };
}

function buildConfig(adminUrl: string | undefined): ConfigService<Env> {
  return { get: jest.fn().mockReturnValue(adminUrl) } as unknown as ConfigService<Env>;
}

function buildPolicy(): OAuthPolicy {
  return {
    canProvision: jest.fn().mockReturnValue({ allowed: true, reason: 'allowed' }),
  } as unknown as OAuthPolicy;
}

function buildResponse(): Response & { redirect: jest.Mock } {
  return { redirect: jest.fn() } as unknown as Response & { redirect: jest.Mock };
}

function redirectedTo(res: Response & { redirect: jest.Mock }): URL {
  return new URL(res.redirect.mock.calls[0]?.[0] as string);
}

describe('OAuth authorization-code exchange', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService(
      {} as unknown as AuthRepository,
      {} as unknown as JwtService,
      {} as unknown as QueueAdapter,
      buildPolicy(),
    );
  });

  afterEach(() => jest.useRealTimers());

  describe('callback redirect', () => {
    it('never puts access or refresh tokens in the redirect URL', () => {
      const controller = new AuthController(service, buildConfig('http://localhost:3001'));
      const res = buildResponse();
      const pair = buildTokenPair();

      controller.googleCallback({ user: pair } as never, res);

      const target = redirectedTo(res);
      const raw = target.toString();
      expect(raw).not.toContain(pair.accessToken);
      expect(raw).not.toContain(pair.refreshToken);
      expect(target.searchParams.get('accessToken')).toBeNull();
      expect(target.searchParams.get('refreshToken')).toBeNull();
      expect(target.searchParams.get('code')).toEqual(expect.any(String));
    });

    it('redirects to the configured admin origin, not an API-relative path', () => {
      const controller = new AuthController(service, buildConfig('https://cms.example.com/admin'));
      const res = buildResponse();

      controller.githubCallback({ user: buildTokenPair() } as never, res);

      const target = redirectedTo(res);
      expect(target.origin).toBe('https://cms.example.com');
      expect(target.pathname).toBe('/admin/oauth-callback');
    });

    it('fails closed when ADMIN_URL is not a usable absolute URL', () => {
      const res = buildResponse();

      expect(() =>
        new AuthController(service, buildConfig('/oauth-callback')).googleCallback(
          { user: buildTokenPair() } as never,
          res,
        ),
      ).toThrow(InternalServerErrorException);
      expect(() =>
        new AuthController(service, buildConfig('javascript:alert(1)')).googleCallback(
          { user: buildTokenPair() } as never,
          res,
        ),
      ).toThrow(InternalServerErrorException);
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('rejects a callback that carries no authenticated token pair', () => {
      const controller = new AuthController(service, buildConfig('http://localhost:3001'));
      expect(() => controller.googleCallback({} as never, buildResponse())).toThrow(
        BadRequestException,
      );
    });
  });

  describe('exchange', () => {
    it('returns the token pair once for a freshly issued code', async () => {
      const controller = new AuthController(service, buildConfig('http://localhost:3001'));
      const res = buildResponse();
      const pair = buildTokenPair();
      controller.googleCallback({ user: pair } as never, res);
      const code = redirectedTo(res).searchParams.get('code') as string;

      await expect(controller.exchangeOAuthCode(code)).resolves.toEqual({ data: pair });
    });

    it('refuses a replayed code (single use)', async () => {
      const code = service.issueOAuthAuthorizationCode(buildTokenPair());

      await expect(service.exchangeOAuthCode(code)).resolves.toMatchObject({
        refreshToken: 'refresh-raw-secret',
      });
      await expect(service.exchangeOAuthCode(code)).rejects.toThrow(UnauthorizedException);
    });

    it('refuses a code that has aged past its short lifetime', async () => {
      jest.useFakeTimers({ now: Date.now() });
      const code = service.issueOAuthAuthorizationCode(buildTokenPair());

      jest.advanceTimersByTime(61_000);

      await expect(service.exchangeOAuthCode(code)).rejects.toThrow(UnauthorizedException);
    });

    it('refuses an unknown code', async () => {
      await expect(service.exchangeOAuthCode('not-a-real-code')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a missing or non-string code before touching the store', async () => {
      const controller = new AuthController(service, buildConfig('http://localhost:3001'));
      expect(() => controller.exchangeOAuthCode(undefined)).toThrow(BadRequestException);
      expect(() => controller.exchangeOAuthCode('')).toThrow(BadRequestException);
      expect(() => controller.exchangeOAuthCode({ toString: () => 'x' })).toThrow(
        BadRequestException,
      );
    });

    it('never mints a code for an unverified provider email claiming an existing account', async () => {
      const repo = {
        findOAuthAccount: jest.fn().mockResolvedValue(null),
        findUserByEmail: jest.fn(),
        createRefreshToken: jest.fn(),
        upsertOAuthAccount: jest.fn(),
        updateLastLogin: jest.fn(),
      } as unknown as AuthRepository;
      const linking = new AuthService(
        repo,
        {} as unknown as JwtService,
        {} as unknown as QueueAdapter,
        buildPolicy(),
      );

      await expect(
        linking.oauthCallback('google', {
          id: 'attacker-gid',
          provider: 'google',
          emails: [{ value: 'admin@kast.local', verified: false }],
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(repo.findUserByEmail).not.toHaveBeenCalled();
    });

    it('issues an unguessable code that is not derived from the tokens', () => {
      const pair = buildTokenPair();
      const first = service.issueOAuthAuthorizationCode(pair);
      const second = service.issueOAuthAuthorizationCode(pair);

      expect(first).not.toBe(second);
      expect(first).not.toContain(pair.accessToken);
      expect(first).not.toContain(pair.refreshToken);
      expect(first.length).toBeGreaterThanOrEqual(32);
    });
  });
});

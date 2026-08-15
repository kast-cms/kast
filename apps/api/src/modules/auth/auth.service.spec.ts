import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { QueueAdapter } from '../queue/queue.adapter';
import { QUEUE_NAMES } from '../queue/queue.constants';
import type { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import type { OAuthPolicy } from './oauth-policy';
import type { OAuthProfile } from './types/oauth.types';

type Mocked<T> = { [K in keyof T]: jest.Mock };

function buildProfile(overrides: Partial<OAuthProfile> = {}): OAuthProfile {
  return {
    id: 'gid',
    provider: 'google',
    emails: [{ value: 'admin@kast.local', verified: true }],
    ...overrides,
  };
}

function buildUser(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'u1',
    email: 'admin@kast.local',
    passwordHash: 'argon-hash',
    firstName: 'Kast',
    lastName: 'Admin',
    avatarUrl: null,
    isActive: true,
    roles: [{ role: { name: 'super_admin' } }],
    ...overrides,
  };
}

describe('AuthService', () => {
  let repo: Mocked<AuthRepository>;
  let jwt: Mocked<JwtService>;
  let queue: Mocked<QueueAdapter>;
  let policy: Mocked<OAuthPolicy>;
  let service: AuthService;

  beforeEach(() => {
    repo = {
      findUserByEmail: jest.fn(),
      findUserById: jest.fn(),
      updateLastLogin: jest.fn().mockResolvedValue(undefined),
      createRefreshToken: jest.fn().mockResolvedValue('refresh-raw'),
      findRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
      revokeAllRefreshTokensForUser: jest.fn().mockResolvedValue({ count: 1 }),
      updateUser: jest.fn(),
      upsertOAuthAccount: jest.fn().mockResolvedValue(undefined),
      findOAuthAccount: jest.fn(),
      createUser: jest.fn(),
      findDefaultRole: jest.fn(),
      upsertPasswordResetToken: jest.fn().mockResolvedValue(undefined),
      findPasswordResetToken: jest.fn(),
      markPasswordResetTokenUsed: jest.fn().mockResolvedValue(undefined),
      generateResetToken: jest.fn().mockReturnValue({ raw: 'reset-raw', hash: 'reset-hash' }),
      generateHashOnly: jest.fn().mockReturnValue({ hash: 'reset-hash' }),
      consumePasswordResetToken: jest.fn().mockResolvedValue('u1'),
      countUsers: jest.fn().mockResolvedValue(0),
      createInitialOwner: jest.fn(),
    } as unknown as Mocked<AuthRepository>;

    jwt = { signAsync: jest.fn().mockResolvedValue('access-jwt') } as unknown as Mocked<JwtService>;
    queue = {
      enqueue: jest.fn().mockResolvedValue(undefined),
      setEphemeral: jest.fn().mockResolvedValue(undefined),
      consumeEphemeral: jest.fn().mockResolvedValue(null),
    } as unknown as Mocked<QueueAdapter>;
    policy = {
      canProvision: jest.fn().mockReturnValue({ allowed: true, reason: 'allowed' }),
    } as unknown as Mocked<OAuthPolicy>;

    service = new AuthService(
      repo as unknown as AuthRepository,
      jwt as unknown as JwtService,
      queue as unknown as QueueAdapter,
      policy as unknown as OAuthPolicy,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  describe('setup', () => {
    const dto = {
      email: 'owner@example.com',
      password: 'Owner1234!',
      firstName: 'Owner',
      lastName: 'One',
    };

    it('creates the first owner as super_admin while no users exist', async () => {
      repo.countUsers.mockResolvedValue(0);
      repo.createInitialOwner.mockResolvedValue(
        buildUser({ id: 'owner1', email: dto.email, firstName: 'Owner', lastName: 'One' }),
      );

      const result = await service.setup(dto);

      expect(result.roles).toEqual(['super_admin']);
      expect(result.email).toBe(dto.email);
      const passwordHash = repo.createInitialOwner.mock.calls[0]?.[0]?.passwordHash as string;
      expect(passwordHash).not.toBe(dto.password);
      await expect(argon2.verify(passwordHash, dto.password)).resolves.toBe(true);
    });

    it('reports setup as required only while the install has no users', async () => {
      repo.countUsers.mockResolvedValue(0);
      await expect(service.isSetupRequired()).resolves.toBe(true);

      repo.countUsers.mockResolvedValue(1);
      await expect(service.isSetupRequired()).resolves.toBe(false);
    });

    it('refuses to create another owner once any user exists', async () => {
      repo.countUsers.mockResolvedValue(1);

      await expect(service.setup(dto)).rejects.toThrow(ForbiddenException);
      expect(repo.createInitialOwner).not.toHaveBeenCalled();
    });

    it('refuses when a concurrent request won the race inside the transaction', async () => {
      repo.countUsers.mockResolvedValue(0);
      repo.createInitialOwner.mockResolvedValue(null);

      await expect(service.setup(dto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('login', () => {
    it('returns a token pair on valid credentials and updates last login', async () => {
      repo.findUserByEmail.mockResolvedValue(buildUser());
      jest.spyOn(argon2, 'verify').mockResolvedValue(true);

      const result = await service.login({ email: 'admin@kast.local', password: 'Admin1234!' });

      expect(result.accessToken).toBe('access-jwt');
      expect(result.refreshToken).toBe('refresh-raw');
      expect(result.expiresIn).toBe(900);
      expect(result.user.roles).toEqual(['super_admin']);
      expect(repo.updateLastLogin).toHaveBeenCalledWith('u1');
      expect(jwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'u1', email: 'admin@kast.local', roles: ['super_admin'] }),
      );
    });

    it('rejects when the user does not exist', async () => {
      repo.findUserByEmail.mockResolvedValue(null);
      await expect(service.login({ email: 'nope@kast.local', password: 'x' })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(repo.updateLastLogin).not.toHaveBeenCalled();
    });

    it('rejects an inactive user without checking the password', async () => {
      repo.findUserByEmail.mockResolvedValue(buildUser({ isActive: false }));
      const verifySpy = jest.spyOn(argon2, 'verify').mockResolvedValue(true);
      await expect(
        service.login({ email: 'admin@kast.local', password: 'Admin1234!' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(verifySpy).not.toHaveBeenCalled();
    });

    it('rejects on wrong password', async () => {
      repo.findUserByEmail.mockResolvedValue(buildUser());
      jest.spyOn(argon2, 'verify').mockResolvedValue(false);
      await expect(service.login({ email: 'admin@kast.local', password: 'wrong' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token and issues a new pair', async () => {
      repo.findRefreshToken.mockResolvedValue({
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });
      repo.findUserById.mockResolvedValue(buildUser());

      const result = await service.refresh('old-refresh');

      expect(repo.revokeRefreshToken).toHaveBeenCalledWith('old-refresh');
      expect(result.accessToken).toBe('access-jwt');
    });

    it('rejects a revoked refresh token', async () => {
      repo.findRefreshToken.mockResolvedValue({
        userId: 'u1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
      });
      await expect(service.refresh('revoked')).rejects.toThrow(UnauthorizedException);
      expect(repo.revokeRefreshToken).not.toHaveBeenCalled();
    });

    it('rejects an expired refresh token', async () => {
      repo.findRefreshToken.mockResolvedValue({
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.refresh('expired')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when the underlying user is now inactive', async () => {
      repo.findRefreshToken.mockResolvedValue({
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });
      repo.findUserById.mockResolvedValue(buildUser({ isActive: false }));
      await expect(service.refresh('valid')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes an active refresh token', async () => {
      repo.findRefreshToken.mockResolvedValue({ userId: 'u1', revokedAt: null });
      await service.logout('tok');
      expect(repo.revokeRefreshToken).toHaveBeenCalledWith('tok');
    });

    it('is a no-op for an already revoked or missing token', async () => {
      repo.findRefreshToken.mockResolvedValue(null);
      await service.logout('tok');
      expect(repo.revokeRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('updates profile fields without touching the password', async () => {
      repo.findUserById.mockResolvedValue(buildUser());
      repo.updateUser.mockResolvedValue({ firstName: 'New' });

      await service.updateProfile('u1', { firstName: 'New' });

      const data = repo.updateUser.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(data.firstName).toBe('New');
      expect(data.passwordHash).toBeUndefined();
    });

    it('requires currentPassword when changing the password', async () => {
      repo.findUserById.mockResolvedValue(buildUser());
      await expect(service.updateProfile('u1', { newPassword: 'longenough' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects when currentPassword is incorrect', async () => {
      repo.findUserById.mockResolvedValue(buildUser());
      jest.spyOn(argon2, 'verify').mockResolvedValue(false);
      await expect(
        service.updateProfile('u1', { currentPassword: 'bad', newPassword: 'longenough' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('hashes and stores a new password when the current one verifies', async () => {
      repo.findUserById.mockResolvedValue(buildUser());
      jest.spyOn(argon2, 'verify').mockResolvedValue(true);
      jest.spyOn(argon2, 'hash').mockResolvedValue('new-hash');
      repo.updateUser.mockResolvedValue({});

      await service.updateProfile('u1', {
        currentPassword: 'Admin1234!',
        newPassword: 'newlongpw',
      });

      const data = repo.updateUser.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(data.passwordHash).toBe('new-hash');
    });
  });

  describe('forgotPassword', () => {
    it('enqueues a reset email for an active user', async () => {
      repo.findUserByEmail.mockResolvedValue(buildUser());
      await service.forgotPassword('admin@kast.local');
      expect(repo.upsertPasswordResetToken).toHaveBeenCalled();
      expect(queue.enqueue).toHaveBeenCalledWith(
        QUEUE_NAMES.EMAIL,
        'password-reset',
        expect.objectContaining({ to: 'admin@kast.local', token: 'reset-raw' }),
      );
    });

    it('silently no-ops for an unknown email (no user enumeration)', async () => {
      repo.findUserByEmail.mockResolvedValue(null);
      await service.forgotPassword('ghost@kast.local');
      expect(queue.enqueue).not.toHaveBeenCalled();
      expect(repo.upsertPasswordResetToken).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('rejects an invalid reset token', async () => {
      repo.consumePasswordResetToken.mockResolvedValue(null);
      await expect(service.resetPassword('tok', 'newpassword')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('consumes the token and stores the new password in one call', async () => {
      jest.spyOn(argon2, 'hash').mockResolvedValue('reset-pw-hash');
      repo.consumePasswordResetToken.mockResolvedValue('u1');

      await service.resetPassword('tok', 'newpassword');

      expect(repo.consumePasswordResetToken).toHaveBeenCalledWith('reset-hash', {
        passwordHash: 'reset-pw-hash',
        markVerified: false,
      });
    });

    it('never marks the token used separately from the password write', async () => {
      jest.spyOn(argon2, 'hash').mockResolvedValue('reset-pw-hash');
      repo.consumePasswordResetToken.mockResolvedValue('u1');

      await service.resetPassword('tok', 'newpassword');

      // A find-then-mark pair is exactly what let two concurrent requests both
      // pass the validity check.
      expect(repo.findPasswordResetToken).not.toHaveBeenCalled();
      expect(repo.markPasswordResetTokenUsed).not.toHaveBeenCalled();
      expect(repo.updateUser).not.toHaveBeenCalled();
    });

    it('lets only one of two concurrent redemptions of the same token succeed', async () => {
      jest.spyOn(argon2, 'hash').mockResolvedValue('reset-pw-hash');
      let spent = false;
      repo.consumePasswordResetToken.mockImplementation(async () => {
        if (spent) return null;
        spent = true;
        return 'u1';
      });

      const results = await Promise.allSettled([
        service.resetPassword('tok', 'newpassword'),
        service.resetPassword('tok', 'otherpassword'),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    });
  });

  describe('acceptInvite', () => {
    it('consumes the token and marks the account verified', async () => {
      jest.spyOn(argon2, 'hash').mockResolvedValue('invite-pw-hash');
      repo.consumePasswordResetToken.mockResolvedValue('u9');

      await service.acceptInvite('invite-tok', 'newpassword');

      expect(repo.consumePasswordResetToken).toHaveBeenCalledWith('reset-hash', {
        passwordHash: 'invite-pw-hash',
        markVerified: true,
      });
    });

    it('rejects a spent or expired invitation token', async () => {
      repo.consumePasswordResetToken.mockResolvedValue(null);
      await expect(service.acceptInvite('tok', 'newpassword')).rejects.toThrow(BadRequestException);
    });
  });

  describe('oauthCallback', () => {
    it('links an existing OAuth account and issues tokens', async () => {
      repo.findOAuthAccount.mockResolvedValue({ userId: 'u1' });
      repo.findUserById.mockResolvedValue(buildUser());

      const result = await service.oauthCallback('google', buildProfile());

      expect(result.accessToken).toBe('access-jwt');
      expect(repo.upsertOAuthAccount).toHaveBeenCalled();
    });

    it('creates a new user with the default role when the policy allows provisioning', async () => {
      repo.findOAuthAccount.mockResolvedValue(null);
      repo.findUserByEmail.mockResolvedValue(null);
      repo.findDefaultRole.mockResolvedValue({ id: 'role-viewer' });
      repo.createUser.mockResolvedValue(
        buildUser({ id: 'u2', roles: [{ role: { name: 'viewer' } }] }),
      );

      const result = await service.oauthCallback(
        'github',
        buildProfile({
          id: 'ghid',
          provider: 'github',
          emails: [{ value: 'new@kast.local', verified: true }],
          name: { givenName: 'New', familyName: 'User' },
        }),
      );

      expect(repo.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@kast.local', defaultRoleId: 'role-viewer' }),
      );
      expect(result.user.roles).toEqual(['viewer']);
    });

    it('throws when the provider supplies no email and no linked account exists', async () => {
      repo.findOAuthAccount.mockResolvedValue(null);
      await expect(service.oauthCallback('google', buildProfile({ emails: [] }))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when no default role is configured for a brand-new user', async () => {
      repo.findOAuthAccount.mockResolvedValue(null);
      repo.findUserByEmail.mockResolvedValue(null);
      repo.findDefaultRole.mockResolvedValue(null);
      await expect(
        service.oauthCallback('google', buildProfile({ emails: [{ value: 'x@kast.local' }] })),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('refuses to provision an unknown identity the policy rejects', async () => {
      repo.findOAuthAccount.mockResolvedValue(null);
      repo.findUserByEmail.mockResolvedValue(null);
      policy.canProvision.mockReturnValue({ allowed: false, reason: 'signup disabled' });

      await expect(
        service.oauthCallback('google', buildProfile({ emails: [{ value: 'x@evil.test' }] })),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.createUser).not.toHaveBeenCalled();
      expect(repo.findDefaultRole).not.toHaveBeenCalled();
    });

    it('still signs in an existing account without consulting the signup policy', async () => {
      repo.findOAuthAccount.mockResolvedValue(null);
      repo.findUserByEmail.mockResolvedValue(buildUser());
      policy.canProvision.mockReturnValue({ allowed: false, reason: 'signup disabled' });

      const result = await service.oauthCallback('google', buildProfile());

      expect(result.accessToken).toBe('access-jwt');
      expect(policy.canProvision).not.toHaveBeenCalled();
    });

    it('refuses to link an existing account when verification is absent', async () => {
      repo.findOAuthAccount.mockResolvedValue(null);
      repo.findUserByEmail.mockResolvedValue(buildUser());

      await expect(
        service.oauthCallback('github', buildProfile({ emails: [{ value: 'admin@kast.local' }] })),
      ).rejects.toThrow(UnauthorizedException);
      expect(repo.upsertOAuthAccount).not.toHaveBeenCalled();
    });

    it('passes the provider verification claim to the policy', async () => {
      repo.findOAuthAccount.mockResolvedValue(null);
      repo.findUserByEmail.mockResolvedValue(null);
      repo.findDefaultRole.mockResolvedValue({ id: 'role-editor' });
      repo.createUser.mockResolvedValue(buildUser({ id: 'u3' }));

      await service.oauthCallback(
        'google',
        buildProfile({ emails: [{ value: 'new@kast.local', verified: true }] }),
      );

      expect(policy.canProvision).toHaveBeenCalledWith('new@kast.local', true);
    });
  });
});

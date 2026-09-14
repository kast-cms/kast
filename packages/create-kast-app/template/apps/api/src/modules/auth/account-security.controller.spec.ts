import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth.types';
import { AccountSecurityController } from './account-security.controller';
import type { AuthRepository } from './auth.repository';
import type { TwoFactorService } from './two-factor.service';

describe('Account security credential boundary', () => {
  it.each([{ isApiToken: true }, { isAgentToken: true }, {}])(
    'rejects noninteractive credentials %j',
    async (flags) => {
      const twoFactor = {
        status: jest.fn(),
        setup: jest.fn(),
        enable: jest.fn(),
      } as unknown as TwoFactorService;
      const repo = {
        listSessions: jest.fn(),
        revokeSession: jest.fn(),
      } as unknown as AuthRepository;
      const controller = new AccountSecurityController(twoFactor, repo);
      const user: AuthUser = {
        id: 'u1',
        email: 'user@example.com',
        roles: ['super_admin'],
        ...flags,
      };
      await expect(controller.status(user)).rejects.toThrow(ForbiddenException);
      await expect(controller.setup(user)).rejects.toThrow(ForbiddenException);
      await expect(controller.enable(user, { code: '123456' })).rejects.toThrow(ForbiddenException);
      await expect(controller.sessions(user)).rejects.toThrow(ForbiddenException);
      await expect(controller.revoke(user, 'another-session')).rejects.toThrow(ForbiddenException);
      expect(repo.revokeSession).not.toHaveBeenCalled();
      expect(twoFactor.enable).not.toHaveBeenCalled();
    },
  );
});

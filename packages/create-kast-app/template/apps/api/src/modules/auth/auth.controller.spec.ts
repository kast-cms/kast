import type { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import type { Env } from '../../config/env.schema';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';

function isPublic(handler: unknown): boolean {
  return new Reflector().get<boolean>(IS_PUBLIC_KEY, handler as never) === true;
}

describe('AuthController route exposure', () => {
  let service: { logout: jest.Mock; acceptInvite: jest.Mock };
  let controller: AuthController;

  beforeEach(() => {
    service = { logout: jest.fn().mockResolvedValue(undefined), acceptInvite: jest.fn() };
    controller = new AuthController(
      service as unknown as AuthService,
      { get: jest.fn() } as unknown as ConfigService<Env>,
    );
  });

  it('exposes logout without a bearer credential', () => {
    // The refresh token in the body is the credential being surrendered; behind
    // the JWT guard this answered 401 and never revoked anything.
    expect(isPublic(AuthController.prototype.logout)).toBe(true);
  });

  it('revokes the refresh token it is handed', async () => {
    await controller.logout({ refreshToken: 'rt-raw' });
    expect(service.logout).toHaveBeenCalledWith('rt-raw');
  });

  it('exposes accept-invite without a bearer credential', () => {
    expect(isPublic(AuthController.prototype.acceptInvite)).toBe(true);
  });

  it('keeps the authenticated profile routes guarded', () => {
    expect(isPublic(AuthController.prototype.me)).toBe(false);
    expect(isPublic(AuthController.prototype.updateProfile)).toBe(false);
  });
});

import { Reflector } from '@nestjs/core';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { HealthController } from './health.controller';

function isPublic(handler: unknown): boolean {
  return new Reflector().get<boolean>(IS_PUBLIC_KEY, handler as never) === true;
}

function roles(handler: unknown): string[] | undefined {
  return new Reflector().get<string[]>(ROLES_KEY, handler as never);
}

describe('HealthController route exposure', () => {
  it('keeps liveness and readiness checks public', () => {
    expect(isPublic(HealthController.prototype.check)).toBe(true);
    expect(isPublic(HealthController.prototype.ready)).toBe(true);
  });

  it('restricts metrics to admin roles', () => {
    expect(isPublic(HealthController.prototype.metrics)).toBe(false);
    expect(roles(HealthController.prototype.metrics)).toEqual([
      SYSTEM_ROLES.ADMIN,
      SYSTEM_ROLES.SUPER_ADMIN,
    ]);
  });

  it('counts only non-trashed content entries in metrics', async () => {
    const queue = {
      getWorkers: jest.fn().mockResolvedValue([{}]),
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, failed: 0 }),
    };
    const prisma = {
      user: { count: jest.fn().mockResolvedValue(1) },
      contentEntry: { count: jest.fn().mockResolvedValue(2) },
      mediaFile: { count: jest.fn().mockResolvedValue(3) },
    };
    const controller = new HealthController(
      {} as never,
      {} as never,
      prisma as never,
      queue as never,
      queue as never,
      queue as never,
      queue as never,
      queue as never,
      queue as never,
      {} as never,
      {} as never,
    );

    await controller.metrics();

    expect(prisma.contentEntry.count).toHaveBeenCalledWith({ where: { trashedAt: null } });
  });
});

import { ForbiddenException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import type { QueueAdapter } from '../queue/queue.adapter';
import type { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import type { OAuthPolicy } from './oauth-policy';

function buildOwner(email: string): User {
  return {
    id: `id-${email}`,
    email,
    passwordHash: 'hash',
    firstName: 'Owner',
    lastName: 'One',
    avatarUrl: null,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as User;
}

describe('AuthService setup concurrency', () => {
  /**
   * Stands in for the database: the count is only observable after a create
   * commits, which is exactly what lets two unserialised setup requests both
   * see an empty table.
   */
  function buildRepo(): AuthRepository {
    let users = 0;
    return {
      countUsers: jest.fn().mockImplementation(async () => users),
      createInitialOwner: jest.fn().mockImplementation(async (data: { email: string }) => {
        if (users > 0) return null;
        await new Promise((resolve) => setTimeout(resolve, 5));
        users += 1;
        return buildOwner(data.email);
      }),
    } as unknown as AuthRepository;
  }

  function buildService(repo: AuthRepository): AuthService {
    const jwt = { signAsync: jest.fn().mockResolvedValue('access-jwt') } as unknown as JwtService;
    const queue = { enqueue: jest.fn().mockResolvedValue(undefined) } as unknown as QueueAdapter;
    const policy = {
      canProvision: jest.fn().mockReturnValue({ allowed: false, reason: 'disabled' }),
    } as unknown as OAuthPolicy;
    return new AuthService(repo, jwt, queue, policy);
  }

  it('creates exactly one owner when eight setup requests arrive at once', async () => {
    const repo = buildRepo();
    const service = buildService(repo);

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        service.setup({
          email: `owner${i}@example.com`,
          password: 'Owner1234!',
          firstName: 'Owner',
          lastName: String(i),
        }),
      ),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);
    for (const rejected of results.filter((r) => r.status === 'rejected')) {
      expect((rejected as PromiseRejectedResult).reason).toBeInstanceOf(ForbiddenException);
    }
    expect(await repo.countUsers()).toBe(1);
  });

  it('lets a queued attempt proceed after an earlier attempt fails', async () => {
    const repo = buildRepo();
    (repo.createInitialOwner as jest.Mock).mockRejectedValueOnce(new Error('transient'));
    const service = buildService(repo);

    const [first, second] = await Promise.allSettled([
      service.setup({
        email: 'first@example.com',
        password: 'Owner1234!',
        firstName: 'First',
        lastName: 'One',
      }),
      service.setup({
        email: 'second@example.com',
        password: 'Owner1234!',
        firstName: 'Second',
        lastName: 'Two',
      }),
    ]);

    expect(first.status).toBe('rejected');
    expect(second.status).toBe('fulfilled');
  });
});

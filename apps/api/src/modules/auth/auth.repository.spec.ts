import type { PrismaService } from '../../prisma/prisma.service';
import { AuthRepository } from './auth.repository';
import { hashResetToken } from './reset-token.util';

interface TokenRow {
  id: string;
  userId: string;
  hash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

/**
 * In-memory stand-in for the reset-token table. `updateMany` re-reads the row
 * at write time the way the database does under the row lock, so a second
 * redemption arriving after the first committed matches nothing.
 */
function buildPrisma(row: TokenRow | null): {
  prisma: PrismaService;
  users: Record<string, unknown>[];
  revokedFor: string[];
} {
  const users: Record<string, unknown>[] = [];
  const revokedFor: string[] = [];
  const tx = {
    passwordResetToken: {
      findFirst: jest.fn(
        async ({ where }: { where: { hash: string; expiresAt: { gt: Date } } }) => {
          if (!row) return null;
          if (row.hash !== where.hash) return null;
          if (row.usedAt !== null) return null;
          if (row.expiresAt <= where.expiresAt.gt) return null;
          return { id: row.id, userId: row.userId };
        },
      ),
      updateMany: jest.fn(async ({ where }: { where: { id: string; usedAt: null } }) => {
        if (row?.id !== where.id || row.usedAt !== null) return { count: 0 };
        row.usedAt = new Date();
        return { count: 1 };
      }),
    },
    user: {
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: unknown }) => {
        users.push({ id: where.id, data });
        return {};
      }),
    },
    refreshToken: {
      updateMany: jest.fn(async ({ where }: { where: { userId: string } }) => {
        revokedFor.push(where.userId);
        return { count: 1 };
      }),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)),
  } as unknown as PrismaService;
  return { prisma, users, revokedFor };
}

function buildRow(overrides: Partial<TokenRow> = {}): TokenRow {
  return {
    id: 'prt1',
    userId: 'u1',
    hash: hashResetToken('raw-token'),
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    ...overrides,
  };
}

describe('AuthRepository.consumePasswordResetToken', () => {
  it('spends the token, writes the password and revokes sessions in one transaction', async () => {
    const { prisma, users, revokedFor } = buildPrisma(buildRow());
    const repo = new AuthRepository(prisma);

    const userId = await repo.consumePasswordResetToken(hashResetToken('raw-token'), {
      passwordHash: 'new-hash',
    });

    expect(userId).toBe('u1');
    expect(users).toEqual([{ id: 'u1', data: { passwordHash: 'new-hash' } }]);
    expect(revokedFor).toEqual(['u1']);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('marks the account verified only when the caller asks for it', async () => {
    const { prisma, users } = buildPrisma(buildRow());
    const repo = new AuthRepository(prisma);

    await repo.consumePasswordResetToken(hashResetToken('raw-token'), {
      passwordHash: 'new-hash',
      markVerified: true,
    });

    expect(users[0]?.data).toEqual({ passwordHash: 'new-hash', isVerified: true });
  });

  it('returns null for an unknown token without touching the user', async () => {
    const { prisma, users } = buildPrisma(buildRow());
    const repo = new AuthRepository(prisma);

    await expect(
      repo.consumePasswordResetToken(hashResetToken('other-token'), { passwordHash: 'x' }),
    ).resolves.toBeNull();
    expect(users).toHaveLength(0);
  });

  it('returns null for an expired token', async () => {
    const { prisma, users } = buildPrisma(buildRow({ expiresAt: new Date(Date.now() - 1000) }));
    const repo = new AuthRepository(prisma);

    await expect(
      repo.consumePasswordResetToken(hashResetToken('raw-token'), { passwordHash: 'x' }),
    ).resolves.toBeNull();
    expect(users).toHaveLength(0);
  });

  it('returns null for a token already spent', async () => {
    const { prisma } = buildPrisma(buildRow({ usedAt: new Date() }));
    const repo = new AuthRepository(prisma);

    await expect(
      repo.consumePasswordResetToken(hashResetToken('raw-token'), { passwordHash: 'x' }),
    ).resolves.toBeNull();
  });

  it('lets only one of two interleaved redemptions win', async () => {
    const { prisma, users } = buildPrisma(buildRow());
    const repo = new AuthRepository(prisma);
    const hash = hashResetToken('raw-token');

    // Both read the token as valid before either writes — the state the old
    // find-then-mark pair could not survive.
    const [first, second] = await Promise.all([
      repo.consumePasswordResetToken(hash, { passwordHash: 'first' }),
      repo.consumePasswordResetToken(hash, { passwordHash: 'second' }),
    ]);

    expect([first, second].filter((r) => r !== null)).toHaveLength(1);
    expect(users).toHaveLength(1);
  });
});

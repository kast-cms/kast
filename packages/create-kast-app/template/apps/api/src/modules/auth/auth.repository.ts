import { Injectable } from '@nestjs/common';
import type {
  ApiToken,
  OAuthAccount,
  PasswordResetToken,
  RefreshToken,
  User,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { PrismaService } from '../../prisma/prisma.service';

/** Mirrors prisma/seed.ts — the roles the RBAC guard expects to exist. */
const SYSTEM_ROLE_SEED = [
  {
    name: 'super_admin',
    displayName: 'Super Admin',
    description: 'Full system access',
    isSystem: true,
  },
  {
    name: 'admin',
    displayName: 'Admin',
    description: 'Manage content, users, and settings',
    isSystem: true,
  },
  {
    name: 'editor',
    displayName: 'Editor',
    description: 'Create and publish content',
    isSystem: true,
  },
  { name: 'viewer', displayName: 'Viewer', description: 'Read-only access', isSystem: true },
] as const;

const DEFAULT_LOCALE_SEED = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    isDefault: true,
    isActive: true,
    direction: 'LTR',
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    isDefault: false,
    isActive: true,
    direction: 'RTL',
  },
] as const;

/**
 * Arbitrary, stable key for the advisory lock guarding first-owner creation.
 * Any other advisory lock in this database must use a different key.
 */
const SETUP_ADVISORY_LOCK_KEY = 4922421n;

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByEmail(email: string): Promise<(User & { roles: { role: { name: string } }[] }) | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: { select: { name: true } } } } },
    });
  }

  findUserById(id: string): Promise<(User & { roles: { role: { name: string } }[] }) | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: { select: { name: true } } } } },
    });
  }

  async createRefreshToken(userId: string, expiresAt: Date): Promise<string> {
    const raw = randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(raw);
    await this.prisma.refreshToken.create({
      data: { tokenHash, userId, expiresAt },
    });
    return raw;
  }

  findRefreshToken(raw: string): Promise<RefreshToken | null> {
    const tokenHash = this.hashToken(raw);
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  revokeRefreshToken(raw: string): Promise<RefreshToken> {
    const tokenHash = this.hashToken(raw);
    return this.prisma.refreshToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  revokeAllRefreshTokensForUser(userId: string): Promise<{ count: number }> {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  findApiToken(
    raw: string,
  ): Promise<(ApiToken & { user: User & { roles: { role: { name: string } }[] } }) | null> {
    const tokenHash = this.hashToken(raw);
    // Expiry is filtered here as well as in the strategy: a token whose
    // expiresAt has passed must never be returned as a valid credential, and
    // pushing the predicate into the query means a future caller of this
    // method cannot forget the check.
    return this.prisma.apiToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { user: { include: { roles: { include: { role: { select: { name: true } } } } } } },
    });
  }

  /**
   * Records API-token usage. Deliberately fire-and-forget: authentication must
   * not pay for this write, and a bookkeeping failure must never turn a valid
   * credential into a 401. The rejection is swallowed explicitly so it cannot
   * surface as an unhandled promise rejection.
   */
  updateApiTokenLastUsed(id: string): void {
    void this.prisma.apiToken
      .update({ where: { id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
  }

  updateLastLogin(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  updateUser(
    userId: string,
    data: { firstName?: string; lastName?: string; avatarUrl?: string; passwordHash?: string },
  ): Promise<User> {
    return this.prisma.user.update({ where: { id: userId }, data });
  }

  hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  findOAuthAccount(provider: string, providerId: string): Promise<OAuthAccount | null> {
    return this.prisma.oAuthAccount.findUnique({
      where: { provider_providerId: { provider, providerId } },
    });
  }

  upsertOAuthAccount(
    userId: string,
    provider: string,
    providerId: string,
    email: string | null,
  ): Promise<OAuthAccount> {
    return this.prisma.oAuthAccount.upsert({
      where: { provider_providerId: { provider, providerId } },
      create: { userId, provider, providerId, email },
      update: { email },
    });
  }

  createUser(data: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
    defaultRoleId: string;
  }): Promise<User & { roles: { role: { name: string } }[] }> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        avatarUrl: data.avatarUrl,
        isActive: true,
        isVerified: true,
        roles: { create: { roleId: data.defaultRoleId } },
      },
      include: { roles: { include: { role: { select: { name: true } } } } },
    });
  }

  findDefaultRole(): Promise<{ id: string } | null> {
    // Role names are stored lowercase (see prisma/seed.ts and SYSTEM_ROLES);
    // the literal 'EDITOR' never matched, so OAuth signup for a new user always
    // failed with "No default role configured".
    return this.prisma.role.findFirst({
      where: { name: SYSTEM_ROLES.EDITOR },
      select: { id: true },
    });
  }

  upsertPasswordResetToken(
    userId: string,
    hash: string,
    expiresAt: Date,
  ): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.upsert({
      where: { userId },
      create: { userId, hash, expiresAt },
      update: { hash, expiresAt, usedAt: null },
    });
  }

  findPasswordResetToken(hash: string): Promise<PasswordResetToken | null> {
    return this.prisma.passwordResetToken.findFirst({
      where: { hash, usedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  markPasswordResetTokenUsed(id: string): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  generateResetToken(): { raw: string; hash: string } {
    const raw = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(raw).digest('hex');
    return { raw, hash };
  }

  generateHashOnly(raw: string): { hash: string } {
    return { hash: createHash('sha256').update(raw).digest('hex') };
  }

  countUsers(): Promise<number> {
    return this.prisma.user.count();
  }

  /**
   * Creates the first owner account together with the system roles and default
   * locales a fresh install needs, in one transaction.
   *
   * A transaction-scoped advisory lock is taken BEFORE the user count. The
   * count alone is not enough: under PostgreSQL's default READ COMMITTED
   * isolation two concurrent transactions both observe zero users and both
   * commit a super_admin. The lock serialises the check-then-create pair
   * across every API process sharing the database, auto-releases on commit or
   * rollback, and needs no migration.
   */
  async createInitialOwner(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
  }): Promise<User | null> {
    return this.prisma.$transaction(async (tx) => {
      // $executeRaw, not $queryRaw: pg_advisory_xact_lock() returns `void`, and
      // Prisma cannot deserialize a void column — $queryRaw throws P2010 here,
      // which made every setup attempt fail with "Database constraint violation".
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SETUP_ADVISORY_LOCK_KEY})`;
      if ((await tx.user.count()) > 0) return null;

      for (const role of SYSTEM_ROLE_SEED) {
        await tx.role.upsert({ where: { name: role.name }, update: {}, create: role });
      }
      for (const locale of DEFAULT_LOCALE_SEED) {
        await tx.locale.upsert({ where: { code: locale.code }, update: {}, create: locale });
      }

      const superAdmin = await tx.role.findUniqueOrThrow({ where: { name: 'super_admin' } });
      return tx.user.create({
        data: {
          email: data.email,
          passwordHash: data.passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          isActive: true,
          roles: { create: [{ roleId: superAdmin.id }] },
        },
      });
    });
  }
}

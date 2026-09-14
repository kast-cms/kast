import { UnauthorizedException } from '@nestjs/common';
import type { RefreshToken, User } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import type { SessionMetadata } from '../../common/types/auth.types';
import type { PrismaService } from '../../prisma/prisma.service';
export type SessionSummary = Pick<
  RefreshToken,
  'id' | 'createdAt' | 'expiresAt' | 'lastUsedAt' | 'userAgent' | 'ipAddress'
>;
function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
export class SessionRepository {
  constructor(protected readonly prisma: PrismaService) {}
  async createSession(
    userId: string,
    expiresAt: Date,
    metadata: SessionMetadata,
    expected: Pick<User, 'passwordHash' | 'twoFactorEnabled' | 'twoFactorSecret'>,
  ): Promise<{ id: string; raw: string }> {
    const raw = randomBytes(40).toString('hex');
    return this.prisma.$transaction(async (tx) => {
      // Serialize issuance with password and second-factor changes on the user row.
      const unchanged = await tx.user.updateMany({
        where: {
          id: userId,
          isActive: true,
          trashedAt: null,
          passwordHash: expected.passwordHash,
          twoFactorEnabled: expected.twoFactorEnabled,
          twoFactorSecret: expected.twoFactorSecret,
        },
        data: { lastLoginAt: new Date() },
      });
      if (!unchanged.count) throw new UnauthorizedException('Account changed. Sign in again');
      const record = await tx.refreshToken.create({
        data: { userId, expiresAt, tokenHash: hashToken(raw), ...metadata, lastUsedAt: new Date() },
      });
      return { id: record.id, raw };
    });
  }

  async rotateSession(raw: string): Promise<(RefreshToken & { raw: string }) | null> {
    const next = randomBytes(40).toString('hex');
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.refreshToken.findUnique({
        where: { tokenHash: hashToken(raw) },
      });
      if (!record) return null;
      const result = await tx.refreshToken.updateMany({
        where: {
          id: record.id,
          tokenHash: hashToken(raw),
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { tokenHash: hashToken(next), lastUsedAt: new Date() },
      });
      return result.count === 1 ? { ...record, raw: next } : null;
    });
  }

  findActiveSession(id: string, userId: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findFirst({
      where: { id, userId, revokedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  listSessions(userId: string): Promise<SessionSummary[]> {
    return this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        lastUsedAt: true,
        userAgent: true,
        ipAddress: true,
      },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  revokeSession(userId: string, id: string): Promise<{ count: number }> {
    return this.prisma.refreshToken.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

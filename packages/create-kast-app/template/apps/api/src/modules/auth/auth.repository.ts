import { Injectable } from '@nestjs/common';
import type {
  ApiToken,
  OAuthAccount,
  PasswordResetToken,
  RefreshToken,
  User,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

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
    return this.prisma.apiToken.findFirst({
      where: { tokenHash, revokedAt: null },
      include: { user: { include: { roles: { include: { role: { select: { name: true } } } } } } },
    });
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
    return this.prisma.role.findFirst({ where: { name: 'EDITOR' }, select: { id: true } });
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
}

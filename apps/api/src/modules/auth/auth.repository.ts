import { Injectable } from '@nestjs/common';
import type { ApiToken, RefreshToken, User } from '@prisma/client';
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
}

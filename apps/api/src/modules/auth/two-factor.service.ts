import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import { SecretEncryptionService } from '../../common/security/secret-encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TotpService, parseRecoveryHashes } from './totp.service';

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly totp: TotpService,
    private readonly encryption: SecretEncryptionService,
  ) {}

  async status(userId: string): Promise<{ enabled: boolean; recoveryCodesRemaining: number }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      enabled: user.twoFactorEnabled,
      recoveryCodesRemaining: parseRecoveryHashes(user.twoFactorRecoveryCodes).length,
    };
  }

  async setup(userId: string): Promise<{ secret: string; otpauthUri: string }> {
    const secret = this.totp.generateSecret();
    const result = await this.prisma.user.updateMany({
      where: { id: userId, isActive: true, twoFactorEnabled: false },
      data: { twoFactorSecret: this.encryption.encrypt(secret), twoFactorLastCounter: null },
    });
    if (!result.count)
      throw new BadRequestException('Two-factor authentication is already enabled');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { secret, otpauthUri: this.totp.buildOtpauthUri(secret, user.email) };
  }

  async enable(
    userId: string,
    code: string,
    sessionId: string,
  ): Promise<{ recoveryCodes: string[] }> {
    const recovery = this.totp.generateRecoveryCodes();
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.twoFactorEnabled || !user.twoFactorSecret)
        throw new BadRequestException('Start two-factor setup first');
      const result = this.totp.verifyTotp(
        code,
        this.encryption.decrypt(user.twoFactorSecret),
        null,
      );
      if (!result.ok) throw new UnauthorizedException('Invalid authentication code');
      const changed = await tx.user.updateMany({
        where: {
          id: userId,
          isActive: true,
          twoFactorEnabled: false,
          twoFactorSecret: user.twoFactorSecret,
        },
        data: {
          twoFactorEnabled: true,
          twoFactorLastCounter: result.timeStep,
          twoFactorRecoveryCodes: JSON.stringify(recovery.hashes),
        },
      });
      if (!changed.count) throw new UnauthorizedException('Setup changed. Try again');
      await this.revokeOthers(tx, userId, sessionId);
    });
    return { recoveryCodes: recovery.raw };
  }

  async verify(userId: string, code: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.consume(tx, userId, code);
    });
  }

  async disable(userId: string, code: string, sessionId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.consume(tx, userId, code);
      await tx.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorLastCounter: null,
          twoFactorRecoveryCodes: null,
        },
      });
      await this.revokeOthers(tx, userId, sessionId);
    });
  }

  async regenerate(
    userId: string,
    code: string,
    sessionId: string,
  ): Promise<{ recoveryCodes: string[] }> {
    const recovery = this.totp.generateRecoveryCodes();
    await this.prisma.$transaction(async (tx) => {
      await this.consume(tx, userId, code);
      await tx.user.update({
        where: { id: userId },
        data: { twoFactorRecoveryCodes: JSON.stringify(recovery.hashes) },
      });
      await this.revokeOthers(tx, userId, sessionId);
    });
    return { recoveryCodes: recovery.raw };
  }

  private async consume(tx: Prisma.TransactionClient, userId: string, code: string): Promise<void> {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user?.isActive || user.trashedAt || !user.twoFactorEnabled || !user.twoFactorSecret)
      throw new UnauthorizedException('Two-factor authentication is unavailable');
    const data = this.verifyCode(user, code);
    // Compare-and-swap serializes concurrent codes, including recovery-code reuse.
    const changed = await tx.user.updateMany({
      where: {
        id: user.id,
        isActive: true,
        twoFactorEnabled: true,
        twoFactorSecret: user.twoFactorSecret,
        twoFactorLastCounter: user.twoFactorLastCounter,
        twoFactorRecoveryCodes: user.twoFactorRecoveryCodes,
      },
      data,
    });
    if (!changed.count) throw new UnauthorizedException('Code already used. Try a new code');
  }

  private verifyCode(user: User, code: string): Prisma.UserUpdateManyMutationInput {
    if (!user.twoFactorSecret)
      throw new UnauthorizedException('Two-factor authentication is unavailable');
    const secret = this.encryption.decrypt(user.twoFactorSecret);
    const result = this.totp.verifyTotp(code, secret, user.twoFactorLastCounter);
    if (result.ok)
      return {
        twoFactorLastCounter: result.timeStep,
      };
    const hashes = parseRecoveryHashes(user.twoFactorRecoveryCodes);
    const index = this.totp.verifyRecoveryCode(code, hashes);
    if (index === null)
      throw new UnauthorizedException('Invalid or previously used authentication code');
    hashes.splice(index, 1);
    return { twoFactorRecoveryCodes: JSON.stringify(hashes) };
  }

  private revokeOthers(
    tx: Prisma.TransactionClient,
    userId: string,
    sessionId: string,
  ): Promise<{ count: number }> {
    return tx.refreshToken.updateMany({
      where: { userId, id: { not: sessionId }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

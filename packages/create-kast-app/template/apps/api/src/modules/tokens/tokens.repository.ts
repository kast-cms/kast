import { Injectable } from '@nestjs/common';
import type { Prisma, TokenScope } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

const TOKEN_BYTES = 24;
const PREFIX_DISPLAY = 8;

const PUBLIC_SELECT = {
  id: true,
  userId: true,
  name: true,
  prefix: true,
  scope: true,
  scopeData: true,
  lastUsedAt: true,
  expiresAt: true,
  revokedAt: true,
  createdAt: true,
} as const;

export type ApiTokenRow = Prisma.ApiTokenGetPayload<{ select: typeof PUBLIC_SELECT }>;

@Injectable()
export class TokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private generate(): { raw: string; prefix: string; tokenHash: string } {
    const rand = randomBytes(TOKEN_BYTES).toString('hex');
    const raw = `kast_${rand}`;
    const prefix = `kast_${rand.slice(0, PREFIX_DISPLAY)}`;
    return { raw, prefix, tokenHash: this.hash(raw) };
  }

  list(userId: string): Promise<ApiTokenRow[]> {
    return this.prisma.apiToken.findMany({
      where: { userId },
      select: PUBLIC_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    userId: string,
    data: {
      name: string;
      scope: TokenScope;
      scopeData: Prisma.InputJsonValue | undefined;
      expiresAt: Date | null;
    },
  ): Promise<{ raw: string; record: ApiTokenRow }> {
    const { raw, prefix, tokenHash } = this.generate();
    const record = await this.prisma.apiToken.create({
      data: {
        userId,
        name: data.name,
        tokenHash,
        prefix,
        scope: data.scope,
        ...(data.scopeData !== undefined ? { scopeData: data.scopeData } : {}),
        expiresAt: data.expiresAt,
      },
      select: PUBLIC_SELECT,
    });
    return { raw, record };
  }

  findById(id: string): Promise<{ id: string; userId: string; revokedAt: Date | null } | null> {
    return this.prisma.apiToken.findUnique({
      where: { id },
      select: { id: true, userId: true, revokedAt: true },
    });
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.apiToken.update({ where: { id }, data: { revokedAt: new Date() } });
  }
}

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
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
  lastUsedAt: true,
  revokedAt: true,
  createdAt: true,
} as const;

export type AgentTokenRow = {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  scope: Prisma.JsonValue;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export type AgentTokenForAuth = {
  id: string;
  name: string;
  scope: Prisma.JsonValue;
  user: {
    id: string;
    email: string;
    isActive: boolean;
    roles: { role: { name: string } }[];
  };
};

@Injectable()
export class AgentTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private generate(): { raw: string; prefix: string; tokenHash: string } {
    const rand = randomBytes(TOKEN_BYTES).toString('hex');
    const raw = `kastagent_${rand}`;
    const prefix = `kastagent_${rand.slice(0, PREFIX_DISPLAY)}`;
    const tokenHash = this.hash(raw);
    return { raw, prefix, tokenHash };
  }

  async create(
    userId: string,
    name: string,
    scopes: string[],
  ): Promise<{ raw: string; record: AgentTokenRow }> {
    const { raw, prefix, tokenHash } = this.generate();
    const record = await this.prisma.agentToken.create({
      data: { userId, name, tokenHash, prefix, scope: scopes },
      select: PUBLIC_SELECT,
    });
    return { raw, record };
  }

  list(userId: string): Promise<AgentTokenRow[]> {
    return this.prisma.agentToken.findMany({
      where: { userId },
      select: PUBLIC_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string, userId: string): Promise<AgentTokenRow | null> {
    return this.prisma.agentToken.findFirst({
      where: { id, userId },
      select: PUBLIC_SELECT,
    });
  }

  findByIdAny(id: string): Promise<{ id: string } | null> {
    return this.prisma.agentToken.findUnique({ where: { id }, select: { id: true } });
  }

  async listToolCalls(
    agentTokenId: string,
    limit: number,
    cursor?: string,
  ): Promise<{
    items: {
      id: string;
      agentName: string | null;
      toolName: string;
      startedAt: Date;
      endedAt: Date | null;
      durationMs: number | null;
      outcome: string | null;
    }[];
    total: number;
  }> {
    const where = { agentTokenId };
    const [items, total] = await Promise.all([
      this.prisma.agentToolCall.findMany({
        where,
        select: {
          id: true,
          agentName: true,
          toolName: true,
          startedAt: true,
          endedAt: true,
          durationMs: true,
          outcome: true,
        },
        orderBy: { startedAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      this.prisma.agentToolCall.count({ where }),
    ]);
    return { items, total };
  }

  async revoke(id: string, userId: string): Promise<boolean> {
    const result = await this.prisma.agentToken.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count > 0;
  }

  findForAuth(raw: string): Promise<AgentTokenForAuth | null> {
    const tokenHash = this.hash(raw);
    return this.prisma.agentToken.findFirst({
      where: { tokenHash, revokedAt: null },
      select: {
        id: true,
        name: true,
        scope: true,
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
            roles: { select: { role: { select: { name: true } } } },
          },
        },
      },
    });
  }

  updateLastUsed(id: string): void {
    void this.prisma.agentToken.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  logToolCall(
    agentTokenId: string,
    agentName: string | undefined,
    toolName: string,
    durationMs: number,
    outcome: string,
  ): void {
    const endedAt = new Date();
    void this.prisma.agentToolCall.create({
      data: {
        agentTokenId,
        agentName: agentName ?? null,
        toolName,
        startedAt: new Date(endedAt.getTime() - durationMs),
        endedAt,
        durationMs,
        outcome,
      },
    });
  }
}

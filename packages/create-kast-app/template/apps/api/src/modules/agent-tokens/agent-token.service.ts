import { Injectable, NotFoundException } from '@nestjs/common';
import { AgentTokenRepository } from './agent-token.repository';
import type { AgentTokenCreatedResponse, AgentTokenRecord } from './dto/agent-token.dto';

@Injectable()
export class AgentTokenService {
  constructor(private readonly repo: AgentTokenRepository) {}

  private toRecord(row: {
    id: string;
    name: string;
    prefix: string;
    scope: unknown;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
  }): AgentTokenRecord {
    return {
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      scopes: Array.isArray(row.scope) ? (row.scope as string[]) : [],
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async list(userId: string): Promise<{ data: AgentTokenRecord[] }> {
    const rows = await this.repo.list(userId);
    return { data: rows.map((r) => this.toRecord(r)) };
  }

  async create(
    userId: string,
    name: string,
    scopes: string[],
  ): Promise<{ data: AgentTokenCreatedResponse }> {
    const { raw, record } = await this.repo.create(userId, name, scopes);
    return { data: { token: raw, record: this.toRecord(record) } };
  }

  async revoke(id: string, userId: string): Promise<void> {
    const ok = await this.repo.revoke(id, userId);
    if (!ok) throw new NotFoundException('Agent token not found or already revoked');
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import type { PaginatedResult } from '../../common/types/auth.types';
import { AgentTokenRepository } from './agent-token.repository';
import type { AgentTokenCreatedResponse, AgentTokenRecord } from './dto/agent-token.dto';

/** One MCP tool invocation. The transport is stateless, so there is no session. */
export interface AgentToolCallRecord {
  id: string;
  agentName: string | null;
  toolName: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  outcome: string | null;
}

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

  async listToolCalls(
    id: string,
    limit: number,
    cursor?: string,
  ): Promise<PaginatedResult<AgentToolCallRecord>> {
    const token = await this.repo.findByIdAny(id);
    if (!token) throw new NotFoundException('Agent token not found');
    const { items, total } = await this.repo.listToolCalls(id, limit, cursor);
    const hasNextPage = items.length > limit;
    const page = hasNextPage ? items.slice(0, limit) : items;
    const nextCursor = hasNextPage ? (page[page.length - 1]?.id ?? null) : null;
    return {
      data: page.map((call) => ({
        id: call.id,
        agentName: call.agentName,
        toolName: call.toolName,
        startedAt: call.startedAt.toISOString(),
        endedAt: call.endedAt?.toISOString() ?? null,
        durationMs: call.durationMs,
        outcome: call.outcome,
      })),
      meta: { total, limit, cursor: nextCursor, hasNextPage },
    };
  }
}

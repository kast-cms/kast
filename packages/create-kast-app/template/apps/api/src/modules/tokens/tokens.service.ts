import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TokenScope, type Prisma } from '@prisma/client';
import type { PaginatedResult } from '../../common/types/auth.types';
import type {
  ApiTokenCreatedResponse,
  ApiTokenSummaryResponse,
  CreateApiTokenDto,
} from './dto/token.dto';
import { TokensRepository, type ApiTokenRow } from './tokens.repository';

@Injectable()
export class TokensService {
  constructor(private readonly repo: TokensRepository) {}

  private extractScopeData(value: ApiTokenRow['scopeData']): Record<string, string[]> | undefined {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, string[]>;
    }
    return undefined;
  }

  private toSummary(row: ApiTokenRow): ApiTokenSummaryResponse {
    const scopeData = this.extractScopeData(row.scopeData);
    return {
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      scope: row.scope,
      ...(scopeData ? { scopeData } : {}),
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async list(userId: string): Promise<PaginatedResult<ApiTokenSummaryResponse>> {
    const rows = await this.repo.list(userId);
    const data = rows.map((r) => this.toSummary(r));
    return {
      data,
      meta: { total: data.length, limit: data.length, cursor: null, hasNextPage: false },
    };
  }

  async create(userId: string, dto: CreateApiTokenDto): Promise<{ data: ApiTokenCreatedResponse }> {
    if (dto.scope === TokenScope.SCOPED && !dto.scopeData) {
      throw new BadRequestException('scopeData is required when scope is SCOPED');
    }
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    const { raw, record } = await this.repo.create(userId, {
      name: dto.name,
      scope: dto.scope,
      scopeData: dto.scopeData as Prisma.InputJsonValue | undefined,
      expiresAt,
    });
    return { data: { ...this.toSummary(record), token: raw } };
  }

  async revoke(id: string, userId: string): Promise<void> {
    const token = await this.repo.findById(id);
    if (!token) throw new NotFoundException(`API token ${id} not found`);
    if (token.userId !== userId) {
      throw new ForbiddenException('You can only revoke your own tokens');
    }
    if (token.revokedAt) return;
    await this.repo.revoke(id);
  }
}

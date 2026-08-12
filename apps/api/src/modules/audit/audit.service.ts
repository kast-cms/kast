import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type AuditLog } from '@prisma/client';
import type { PaginatedResult } from '../../common/types/auth.types';
import { AuditRepository } from './audit.repository';
import type { AuditQueryDto } from './dto/audit-query.dto';

export interface LogActionParams {
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  agentTokenId?: string;
  agentName?: string;
  changes?: Prisma.InputJsonValue;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
  isDryRun?: boolean;
}

function orNull<T>(value: T | undefined): T | null {
  return value ?? null;
}

function orJsonNull(
  value: Prisma.InputJsonValue | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value ?? Prisma.JsonNull;
}

@Injectable()
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  async logAction(params: LogActionParams): Promise<void> {
    await this.auditRepository.create({
      action: params.action,
      resource: params.resource,
      resourceId: orNull(params.resourceId),
      userId: orNull(params.userId),
      agentTokenId: orNull(params.agentTokenId),
      agentName: orNull(params.agentName),
      before: orJsonNull(params.before),
      after: orJsonNull(params.after),
      metadata: orJsonNull(params.changes),
      ipAddress: orNull(params.ipAddress),
      userAgent: orNull(params.userAgent),
      isDryRun: params.isDryRun ?? false,
    });
  }

  async findAll(query: AuditQueryDto): Promise<PaginatedResult<AuditLog>> {
    const limit = query.limit ?? 20;
    const { items, total } = await this.auditRepository.findAll(query);
    const hasNextPage = items.length > limit;
    const data = hasNextPage ? items.slice(0, limit) : items;
    const cursor = hasNextPage ? (data[data.length - 1]?.id ?? null) : null;
    return { data, meta: { total, limit, cursor, hasNextPage } };
  }

  async findById(id: string): Promise<AuditLog> {
    const log = await this.auditRepository.findById(id);
    if (!log) throw new NotFoundException(`Audit log ${id} not found`);
    return log;
  }

  async exportCsv(query: AuditQueryDto): Promise<string> {
    const limit = 5000;
    const { items } = await this.auditRepository.findAll({ ...query, limit });
    const header = 'id,userId,agentTokenId,action,resource,resourceId,ipAddress,createdAt';
    const rows = items.map((row) =>
      [
        row.id,
        row.userId ?? '',
        row.agentTokenId ?? '',
        row.action,
        row.resource,
        row.resourceId ?? '',
        row.ipAddress ?? '',
        row.createdAt.toISOString(),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    return [header, ...rows].join('\n');
  }
}

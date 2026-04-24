import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, type AuditLog } from '@prisma/client';
import type { PaginatedResult } from '../../common/types/auth.types';
import { AuditRepository } from './audit.repository';
import type { AuditQueryDto } from './dto/audit-query.dto';

export interface LogActionParams {
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  changes?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly auditRepository: AuditRepository) {}

  logAction(params: LogActionParams): void {
    this.auditRepository
      .create({
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId ?? null,
        userId: params.userId ?? null,
        metadata: params.changes ?? Prisma.JsonNull,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      })
      .catch((err: unknown) => {
        this.logger.error('Failed to write audit log', err);
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
}

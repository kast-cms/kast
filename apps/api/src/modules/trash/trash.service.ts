import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { TrashModel, TrashQueryDto, TrashedItemDto } from './dto/trash-query.dto';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function daysUntilDeletion(trashedAt: Date): number {
  const deletionDate = new Date(trashedAt.getTime() + THIRTY_DAYS_MS);
  return Math.max(0, Math.ceil((deletionDate.getTime() - Date.now()) / 86_400_000));
}

@Injectable()
export class TrashService {
  private readonly logger = new Logger(TrashService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: TrashQueryDto): Promise<{ items: TrashedItemDto[]; total: number }> {
    const limit = query.limit ?? 20;
    const model = query.model;
    const cursor = query.cursor;
    const items: TrashedItemDto[] = [];
    let total = 0;

    if (model === undefined || model === 'content') {
      const [rows, count] = await this.listContent(limit, cursor);
      items.push(...rows);
      total += count;
    }
    if (model === undefined || model === 'media') {
      const [rows, count] = await this.listMedia(limit);
      items.push(...rows);
      total += count;
    }
    if (model === undefined || model === 'user') {
      const [rows, count] = await this.listUsers(limit);
      items.push(...rows);
      total += count;
    }
    if (model === undefined || model === 'form') {
      const [rows, count] = await this.listForms(limit);
      items.push(...rows);
      total += count;
    }

    return { items: items.slice(0, limit), total };
  }

  async restore(model: TrashModel, id: string, userId: string): Promise<void> {
    await this.assertTrashed(model, id);
    await this.applyRestore(model, id);
    this.audit.logAction({ action: 'RESTORE', resource: model, resourceId: id, userId });
    this.logger.log(`Restored ${model}:${id} by user ${userId}`);
  }

  async permanentDelete(model: TrashModel, id: string, userId: string): Promise<void> {
    await this.assertTrashed(model, id);
    await this.applyHardDelete(model, id);
    this.audit.logAction({
      action: 'PERMANENT_DELETE',
      resource: model,
      resourceId: id,
      userId,
    });
    this.logger.log(`Permanently deleted ${model}:${id} by user ${userId}`);
  }

  private async listContent(limit: number, cursor?: string): Promise<[TrashedItemDto[], number]> {
    const where = { trashedAt: { not: null } } as const;
    const [rows, count] = await Promise.all([
      this.prisma.contentEntry.findMany({
        where,
        include: { locales: { take: 1 } },
        orderBy: { trashedAt: 'desc' },
        take: limit,
        ...(cursor !== undefined ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      this.prisma.contentEntry.count({ where }),
    ]);
    const items: TrashedItemDto[] = rows.map((r) => ({
      id: r.id,
      model: 'content' as const,
      name: r.locales[0]?.slug ?? r.id,
      trashedAt: (r.trashedAt ?? new Date()).toISOString(),
      trashedByUserId: r.trashedByUserId ?? null,
      daysUntilDeletion: daysUntilDeletion(r.trashedAt ?? new Date()),
    }));
    return [items, count];
  }

  private async listMedia(limit: number): Promise<[TrashedItemDto[], number]> {
    const where = { trashedAt: { not: null } } as const;
    const [rows, count] = await Promise.all([
      this.prisma.mediaFile.findMany({
        where,
        orderBy: { trashedAt: 'desc' },
        take: limit,
      }),
      this.prisma.mediaFile.count({ where }),
    ]);
    const items: TrashedItemDto[] = rows.map((r) => ({
      id: r.id,
      model: 'media' as const,
      name: r.originalName,
      trashedAt: (r.trashedAt ?? new Date()).toISOString(),
      trashedByUserId: r.trashedByUserId ?? null,
      daysUntilDeletion: daysUntilDeletion(r.trashedAt ?? new Date()),
    }));
    return [items, count];
  }

  private async listUsers(limit: number): Promise<[TrashedItemDto[], number]> {
    const where = { trashedAt: { not: null } } as const;
    const [rows, count] = await Promise.all([
      this.prisma.user.findMany({ where, orderBy: { trashedAt: 'desc' }, take: limit }),
      this.prisma.user.count({ where }),
    ]);
    const items: TrashedItemDto[] = rows.map((r) => ({
      id: r.id,
      model: 'user' as const,
      name: r.email,
      trashedAt: (r.trashedAt ?? new Date()).toISOString(),
      trashedByUserId: r.trashedByUserId ?? null,
      daysUntilDeletion: daysUntilDeletion(r.trashedAt ?? new Date()),
    }));
    return [items, count];
  }

  private async listForms(limit: number): Promise<[TrashedItemDto[], number]> {
    const where = { trashedAt: { not: null } } as const;
    const [rows, count] = await Promise.all([
      this.prisma.form.findMany({ where, orderBy: { trashedAt: 'desc' }, take: limit }),
      this.prisma.form.count({ where }),
    ]);
    const items: TrashedItemDto[] = rows.map((r) => ({
      id: r.id,
      model: 'form' as const,
      name: r.name,
      trashedAt: (r.trashedAt ?? new Date()).toISOString(),
      trashedByUserId: r.trashedByUserId ?? null,
      daysUntilDeletion: daysUntilDeletion(r.trashedAt ?? new Date()),
    }));
    return [items, count];
  }

  private async assertTrashed(model: TrashModel, id: string): Promise<void> {
    const item = await this.findTrashedById(model, id);
    if (item === null) throw new NotFoundException(`${model} ${id} not found in trash`);
  }

  private async findTrashedById(model: TrashModel, id: string): Promise<{ id: string } | null> {
    const where = { id, trashedAt: { not: null } } as const;
    if (model === 'content')
      return this.prisma.contentEntry.findFirst({ where, select: { id: true } });
    if (model === 'media') return this.prisma.mediaFile.findFirst({ where, select: { id: true } });
    if (model === 'user') return this.prisma.user.findFirst({ where, select: { id: true } });
    return this.prisma.form.findFirst({ where, select: { id: true } });
  }

  private async applyRestore(model: TrashModel, id: string): Promise<void> {
    if (model === 'content') {
      await this.prisma.contentEntry.update({
        where: { id },
        data: { trashedAt: null, trashedByUserId: null, status: 'DRAFT' },
      });
    } else if (model === 'media') {
      await this.prisma.mediaFile.update({
        where: { id },
        data: { trashedAt: null, trashedByUserId: null },
      });
    } else if (model === 'user') {
      await this.prisma.user.update({
        where: { id },
        data: { trashedAt: null, trashedByUserId: null },
      });
    } else {
      await this.prisma.form.update({
        where: { id },
        data: { trashedAt: null, trashedByUserId: null },
      });
    }
  }

  private async applyHardDelete(model: TrashModel, id: string): Promise<void> {
    if (model === 'content') {
      await this.prisma.contentEntry.delete({ where: { id } });
    } else if (model === 'media') {
      await this.prisma.mediaFile.delete({ where: { id } });
    } else if (model === 'user') {
      await this.prisma.user.delete({ where: { id } });
    } else {
      await this.prisma.form.delete({ where: { id } });
    }
  }
}

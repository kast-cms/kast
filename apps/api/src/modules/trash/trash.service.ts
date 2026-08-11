import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../../common/types/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MediaService } from '../media/media.service';
import {
  TRASH_MODELS,
  type TrashListResult,
  type TrashModel,
  type TrashPurgeSummary,
  type TrashQueryDto,
  type TrashedItemDto,
} from './dto/trash-query.dto';
import { assertActorOutranksTarget } from './trash-actor.guard';
import { decodeTrashCursor, encodeTrashCursor, type TrashCursor } from './trash-cursor.util';
import { TRASH_RETENTION_MS } from './trash.constants';

interface RankedItem {
  item: TrashedItemDto;
  trashedAt: Date;
}

/** The four trashable models share these columns, so one filter serves them all. */
type TrashedWhere = Prisma.ContentEntryWhereInput &
  Prisma.MediaFileWhereInput &
  Prisma.UserWhereInput &
  Prisma.FormWhereInput;

function daysUntilDeletion(trashedAt: Date): number {
  const deletionDate = new Date(trashedAt.getTime() + TRASH_RETENTION_MS);
  return Math.max(0, Math.ceil((deletionDate.getTime() - Date.now()) / 86_400_000));
}

/** Newest first, with `id` as the tiebreak the keyset predicate also uses. */
function byTrashedAtDesc(a: RankedItem, b: RankedItem): number {
  const diff = b.trashedAt.getTime() - a.trashedAt.getTime();
  if (diff !== 0) return diff;
  return b.item.id.localeCompare(a.item.id);
}

@Injectable()
export class TrashService {
  private readonly logger = new Logger(TrashService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
  ) {}

  /**
   * Pages across every trashable model as one ordered stream: each model is
   * asked for the same keyset window, the windows are merged by `trashedAt`,
   * and the cursor points at the last row that was actually returned. Slicing a
   * concatenation instead would let whichever model is queried first fill the
   * page and strand the others.
   */
  async list(query: TrashQueryDto): Promise<TrashListResult> {
    const limit = query.limit ?? 20;
    const cursor = decodeTrashCursor(query.cursor);
    const models = query.model === undefined ? [...TRASH_MODELS] : [query.model];

    const pages = await Promise.all(models.map((model) => this.listModel(model, limit, cursor)));
    const merged = pages.flatMap(([rows]) => rows).sort(byTrashedAtDesc);
    const total = pages.reduce((sum, [, count]) => sum + count, 0);

    const page = merged.slice(0, limit);
    const last = page[page.length - 1];
    const hasMore = merged.length > page.length;
    const names = await this.resolveActorNames(page);

    return {
      items: page.map((row) => ({
        ...row.item,
        trashedByName:
          row.item.trashedByUserId === null ? null : (names.get(row.item.trashedByUserId) ?? null),
      })),
      total,
      nextCursor:
        hasMore && last !== undefined
          ? encodeTrashCursor({ trashedAt: last.trashedAt, id: last.item.id })
          : null,
    };
  }

  async restore(model: TrashModel, id: string, actor: AuthUser): Promise<void> {
    await this.assertTrashed(model, id);
    await assertActorOutranksTarget(this.prisma, model, id, actor);
    await this.applyRestore(model, id);
    this.audit.logAction({ action: 'RESTORE', resource: model, resourceId: id, userId: actor.id });
    this.logger.log(`Restored ${model}:${id} by user ${actor.id}`);
  }

  async permanentDelete(model: TrashModel, id: string, actor: AuthUser): Promise<void> {
    await this.assertTrashed(model, id);
    await assertActorOutranksTarget(this.prisma, model, id, actor);
    await this.applyHardDelete(model, id);
    this.audit.logAction({
      action: 'PERMANENT_DELETE',
      resource: model,
      resourceId: id,
      userId: actor.id,
    });
    this.logger.log(`Permanently deleted ${model}:${id} by user ${actor.id}`);
  }

  /**
   * Deletes every model that is offered as recoverable once retention expires.
   * Records are removed one at a time so a single row the database refuses to
   * delete (a user still referenced as an author, for instance) is reported
   * instead of aborting the rest of the purge.
   */
  async purgeExpired(now: Date = new Date()): Promise<TrashPurgeSummary> {
    const cutoff = new Date(now.getTime() - TRASH_RETENTION_MS);
    const models = {} as TrashPurgeSummary['models'];

    for (const model of TRASH_MODELS) {
      const ids = await this.findExpiredIds(model, cutoff);
      let deleted = 0;
      let failed = 0;
      for (const id of ids) {
        try {
          await this.applyHardDelete(model, id);
          deleted += 1;
          this.audit.logAction({
            action: 'PERMANENT_DELETE',
            resource: model,
            resourceId: id,
            changes: { reason: 'retention', cutoff: cutoff.toISOString() },
          });
        } catch (err: unknown) {
          failed += 1;
          this.logger.error(`Failed to purge ${model}:${id}`, err);
        }
      }
      models[model] = { deleted, failed };
    }
    return { cutoff, models };
  }

  /**
   * One lookup for the whole page rather than a join per model: the four
   * listings are separate queries, so a relation include would be four joins
   * for what is usually a handful of distinct actors.
   */
  private async resolveActorNames(page: RankedItem[]): Promise<Map<string, string>> {
    const ids = [
      ...new Set(page.map((r) => r.item.trashedByUserId).filter((id): id is string => id !== null)),
    ];
    if (ids.length === 0) return new Map();

    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    return new Map(
      users.map((u) => [
        u.id,
        [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email,
      ]),
    );
  }

  private async listModel(
    model: TrashModel,
    limit: number,
    cursor: TrashCursor | undefined,
  ): Promise<[RankedItem[], number]> {
    if (model === 'content') return this.listContent(limit, cursor);
    if (model === 'media') return this.listMedia(limit, cursor);
    if (model === 'user') return this.listUsers(limit, cursor);
    return this.listForms(limit, cursor);
  }

  /**
   * `limit + 1` rows per model is what makes "is there another page" answerable
   * after the merge without a second round trip.
   */
  private pageArgs(
    limit: number,
    cursor: TrashCursor | undefined,
  ): {
    where: TrashedWhere;
    orderBy: [{ trashedAt: 'desc' }, { id: 'desc' }];
    take: number;
  } {
    const keyset =
      cursor === undefined
        ? {}
        : {
            OR: [
              { trashedAt: { lt: cursor.trashedAt } },
              { trashedAt: cursor.trashedAt, id: { lt: cursor.id } },
            ],
          };
    return {
      where: { trashedAt: { not: null }, ...keyset },
      orderBy: [{ trashedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    };
  }

  private toRanked(
    model: TrashModel,
    row: { id: string; trashedAt: Date | null; trashedByUserId: string | null },
    name: string,
  ): RankedItem {
    const trashedAt = row.trashedAt ?? new Date();
    return {
      trashedAt,
      item: {
        id: row.id,
        model,
        name,
        trashedAt: trashedAt.toISOString(),
        trashedByUserId: row.trashedByUserId ?? null,
        trashedByName: null, // filled in per page by resolveActorNames
        daysUntilDeletion: daysUntilDeletion(trashedAt),
      },
    };
  }

  private async listContent(
    limit: number,
    cursor: TrashCursor | undefined,
  ): Promise<[RankedItem[], number]> {
    const { where, orderBy, take } = this.pageArgs(limit, cursor);
    const [rows, count] = await Promise.all([
      this.prisma.contentEntry.findMany({
        where,
        include: { locales: { take: 1 } },
        orderBy,
        take,
      }),
      this.prisma.contentEntry.count({ where: { trashedAt: { not: null } } }),
    ]);
    return [rows.map((r) => this.toRanked('content', r, r.locales[0]?.slug ?? r.id)), count];
  }

  private async listMedia(
    limit: number,
    cursor: TrashCursor | undefined,
  ): Promise<[RankedItem[], number]> {
    const { where, orderBy, take } = this.pageArgs(limit, cursor);
    const [rows, count] = await Promise.all([
      this.prisma.mediaFile.findMany({ where, orderBy, take }),
      this.prisma.mediaFile.count({ where: { trashedAt: { not: null } } }),
    ]);
    return [rows.map((r) => this.toRanked('media', r, r.originalName)), count];
  }

  private async listUsers(
    limit: number,
    cursor: TrashCursor | undefined,
  ): Promise<[RankedItem[], number]> {
    const { where, orderBy, take } = this.pageArgs(limit, cursor);
    const [rows, count] = await Promise.all([
      this.prisma.user.findMany({ where, orderBy, take }),
      this.prisma.user.count({ where: { trashedAt: { not: null } } }),
    ]);
    return [rows.map((r) => this.toRanked('user', r, r.email)), count];
  }

  private async listForms(
    limit: number,
    cursor: TrashCursor | undefined,
  ): Promise<[RankedItem[], number]> {
    const { where, orderBy, take } = this.pageArgs(limit, cursor);
    const [rows, count] = await Promise.all([
      this.prisma.form.findMany({ where, orderBy, take }),
      this.prisma.form.count({ where: { trashedAt: { not: null } } }),
    ]);
    return [rows.map((r) => this.toRanked('form', r, r.name)), count];
  }

  private async findExpiredIds(model: TrashModel, cutoff: Date): Promise<string[]> {
    const where = { trashedAt: { lte: cutoff } } as const;
    const select = { id: true } as const;
    const rows =
      model === 'content'
        ? await this.prisma.contentEntry.findMany({ where, select })
        : model === 'media'
          ? await this.prisma.mediaFile.findMany({ where, select })
          : model === 'user'
            ? await this.prisma.user.findMany({ where, select })
            : await this.prisma.form.findMany({ where, select });
    return rows.map((r) => r.id);
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
      // Trashing a user also deactivates the account, so restoring has to undo
      // both or the account comes back unable to sign in.
      await this.prisma.user.update({
        where: { id },
        data: { trashedAt: null, trashedByUserId: null, isActive: true },
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
      // Deleting the row directly would strand the stored object: MediaService
      // owns the storage adapter and is the only path that releases the bytes.
      await this.media.purge(id);
    } else if (model === 'user') {
      await this.prisma.user.delete({ where: { id } });
    } else {
      await this.prisma.form.delete({ where: { id } });
    }
  }
}

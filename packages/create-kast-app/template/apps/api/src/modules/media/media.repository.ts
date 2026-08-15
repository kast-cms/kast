import { Injectable } from '@nestjs/common';
import type { MediaFile, MediaFolder, Prisma } from '@prisma/client';
import { SortOrder } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { ListMediaDto, MediaSortField } from './dto/list-media.dto';

export type FolderWithCounts = MediaFolder & {
  _count: { files: number; children: number };
};

export type MediaListRow = MediaFile & {
  folder: Pick<MediaFolder, 'id' | 'name'> | null;
  _count: { usages: number };
};

export type MediaDetailRow = MediaListRow & {
  usages: Array<{
    entryId: string;
    fieldName: string;
    entry: {
      contentType: { name: string };
      locales: Array<{ data: Prisma.JsonValue }>;
    };
  }>;
};

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListMediaDto): Promise<{ items: MediaListRow[]; total: number }> {
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const where: Prisma.MediaFileWhereInput = {
      trashedAt: null,
      ...(query.folderId ? { folderId: query.folderId } : {}),
      // The library filters by MIME prefix ("image/", "video/", ...) as well as
      // by a full type, so match on the prefix rather than on equality.
      ...(query.mimeType ? { mimeType: { startsWith: query.mimeType } } : {}),
      ...(search
        ? {
            OR: [
              { filename: { contains: search, mode: 'insensitive' } },
              { originalName: { contains: search, mode: 'insensitive' } },
              { altText: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const sortField = query.sort ?? MediaSortField.CREATED_AT;
    const order = query.order ?? SortOrder.DESC;
    const [items, total] = await Promise.all([
      this.prisma.mediaFile.findMany({
        where,
        orderBy: { [sortField]: order } as Prisma.MediaFileOrderByWithRelationInput,
        take: limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        include: {
          folder: { select: { id: true, name: true } },
          _count: { select: { usages: true } },
        },
      }),
      this.prisma.mediaFile.count({ where }),
    ]);
    return { items: items as MediaListRow[], total };
  }

  findById(id: string): Promise<MediaDetailRow | null> {
    return this.prisma.mediaFile.findFirst({
      where: { id, trashedAt: null },
      include: {
        folder: { select: { id: true, name: true } },
        _count: { select: { usages: true } },
        usages: {
          select: {
            entryId: true,
            fieldName: true,
            entry: {
              select: {
                contentType: { select: { name: true } },
                locales: { take: 1, select: { data: true } },
              },
            },
          },
        },
      },
    }) as Promise<MediaDetailRow | null>;
  }

  findActiveByStorageKey(storageKey: string): Promise<Pick<MediaFile, 'id'> | null> {
    return this.prisma.mediaFile.findFirst({
      where: {
        trashedAt: null,
        OR: [{ storageKey }, { storageKey: `${storageKey}.webp` }],
      },
      select: { id: true },
    });
  }

  /** Used by permanent delete, which has to reach rows already in the trash. */
  findByIdIncludingTrashed(id: string): Promise<MediaFile | null> {
    return this.prisma.mediaFile.findUnique({ where: { id } });
  }

  create(data: Prisma.MediaFileCreateInput): Promise<MediaFile> {
    return this.prisma.mediaFile.create({ data });
  }

  update(id: string, data: Prisma.MediaFileUpdateInput): Promise<MediaFile> {
    return this.prisma.mediaFile.update({ where: { id }, data });
  }

  /** `trashedByUserId` is what lets the trash screen name who deleted a row. */
  softDelete(id: string, trashedByUserId?: string): Promise<MediaFile> {
    return this.prisma.mediaFile.update({
      where: { id },
      data: { trashedAt: new Date(), trashedByUserId: trashedByUserId ?? null },
    });
  }

  async hardDelete(id: string): Promise<void> {
    await this.prisma.mediaFile.delete({ where: { id } });
  }

  // ── Folders ──────────────────────────────────────────────

  listFolders(): Promise<FolderWithCounts[]> {
    return this.prisma.mediaFolder.findMany({
      include: { _count: { select: { files: true, children: true } } },
      orderBy: { name: 'asc' },
    });
  }

  findFolderById(id: string): Promise<FolderWithCounts | null> {
    return this.prisma.mediaFolder.findUnique({
      where: { id },
      include: { _count: { select: { files: true, children: true } } },
    });
  }

  createFolder(name: string, parentId: string | null): Promise<MediaFolder> {
    return this.prisma.mediaFolder.create({ data: { name, parentId } });
  }

  updateFolder(
    id: string,
    data: { name?: string; parentId?: string | null },
  ): Promise<MediaFolder> {
    return this.prisma.mediaFolder.update({ where: { id }, data });
  }

  async deleteFolder(id: string): Promise<void> {
    await this.prisma.mediaFolder.delete({ where: { id } });
  }
}

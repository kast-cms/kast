import { Injectable } from '@nestjs/common';
import type { ContentEntry, ContentEntryLocale, ContentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ContentQueryDto } from './dto/content-query.dto';

export type EntryWithLocale = ContentEntry & { locales: ContentEntryLocale[] };

@Injectable()
export class ContentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    contentTypeId: string,
    query: ContentQueryDto,
  ): Promise<{ items: EntryWithLocale[]; total: number }> {
    const limit = query.limit ?? 20;
    const where: Prisma.ContentEntryWhereInput = {
      contentTypeId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.contentEntry.findMany({
        where,
        include: { locales: query.locale ? { where: { localeCode: query.locale } } : true },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      this.prisma.contentEntry.count({ where }),
    ]);

    return { items: items as EntryWithLocale[], total };
  }

  findById(id: string, locale?: string): Promise<EntryWithLocale | null> {
    return this.prisma.contentEntry.findUnique({
      where: { id },
      include: { locales: locale ? { where: { localeCode: locale } } : true },
    }) as Promise<EntryWithLocale | null>;
  }

  create(
    contentTypeId: string,
    data: Record<string, unknown>,
    locale: string,
    authorId: string,
    slug: string,
  ): Promise<EntryWithLocale> {
    return this.prisma.contentEntry.create({
      data: {
        contentTypeId,
        createdById: authorId,
        locales: {
          create: {
            localeCode: locale,
            slug,
            data: data as Prisma.InputJsonValue,
          },
        },
      },
      include: { locales: true },
    }) as Promise<EntryWithLocale>;
  }

  update(
    id: string,
    locale: string,
    data: Record<string, unknown>,
    slug?: string,
  ): Promise<EntryWithLocale> {
    return this.prisma.contentEntry.update({
      where: { id },
      data: {
        locales: {
          upsert: {
            where: { entryId_localeCode: { entryId: id, localeCode: locale } },
            create: {
              localeCode: locale,
              slug: slug ?? locale,
              data: data as Prisma.InputJsonValue,
            },
            update: { data: data as Prisma.InputJsonValue },
          },
        },
      },
      include: { locales: true },
    }) as Promise<EntryWithLocale>;
  }

  updateStatus(id: string, status: ContentStatus, publishedAt?: Date): Promise<ContentEntry> {
    return this.prisma.contentEntry.update({
      where: { id },
      data: { status, publishedAt: publishedAt ?? null },
    });
  }

  trash(id: string): Promise<ContentEntry> {
    return this.prisma.contentEntry.update({
      where: { id },
      data: { status: 'TRASHED', trashedAt: new Date() },
    });
  }

  async createVersion(
    entryId: string,
    data: Record<string, unknown>,
    localesData: Record<string, unknown>,
    savedById: string,
    status: ContentStatus,
  ): Promise<void> {
    const latest = await this.prisma.contentEntryVersion.findFirst({
      where: { entryId },
      orderBy: { versionNumber: 'desc' },
    });
    await this.prisma.contentEntryVersion.create({
      data: {
        entryId,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        status,
        data: data as Prisma.InputJsonValue,
        localesData: localesData as Prisma.InputJsonValue,
        savedById,
      },
    });
  }
}

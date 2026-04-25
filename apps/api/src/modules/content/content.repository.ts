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

  async findActiveLocaleCodes(): Promise<string[]> {
    const locales = await this.prisma.locale.findMany({
      where: { isActive: true },
      select: { code: true },
    });
    return locales.map((l) => l.code);
  }

  async getLocaleFallbackChain(localeCode: string): Promise<string[]> {
    const chain: string[] = [localeCode];
    let current = localeCode;
    for (let depth = 0; depth < 5; depth++) {
      const row = await this.prisma.locale.findUnique({
        where: { code: current },
        select: { fallbackCode: true },
      });
      const fallbackCode = row?.fallbackCode;
      if (!fallbackCode) break;
      chain.push(fallbackCode);
      current = fallbackCode;
    }
    return chain;
  }

  async findByIdWithFallback(id: string, locale: string): Promise<EntryWithLocale | null> {
    const chain = await this.getLocaleFallbackChain(locale);
    const entry = await this.prisma.contentEntry.findUnique({
      where: { id },
      include: { locales: { where: { localeCode: { in: chain } } } },
    });
    if (!entry) return null;
    for (const code of chain) {
      const match = entry.locales.find((l) => l.localeCode === code);
      if (match) return { ...entry, locales: [match] } as EntryWithLocale;
    }
    return { ...entry, locales: [] } as EntryWithLocale;
  }

  create(
    contentTypeId: string,
    data: Record<string, unknown>,
    locale: string,
    authorId: string,
    slug: string,
    extraLocaleCodes: string[] = [],
  ): Promise<EntryWithLocale> {
    const extraLocales = extraLocaleCodes
      .filter((code) => code !== locale)
      .map((code) => ({
        localeCode: code,
        slug: `${slug}-${code}`,
        data: {} as Prisma.InputJsonValue,
      }));

    return this.prisma.contentEntry.create({
      data: {
        contentTypeId,
        createdById: authorId,
        locales: {
          create: [
            { localeCode: locale, slug, data: data as Prisma.InputJsonValue },
            ...extraLocales,
          ],
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

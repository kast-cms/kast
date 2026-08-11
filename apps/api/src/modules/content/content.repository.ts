import { Injectable } from '@nestjs/common';
import type {
  ContentEntry,
  ContentEntryLocale,
  ContentEntryVersion,
  ContentStatus,
  Prisma,
  User,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveLocaleFallbackChain } from './content-locale.ops';
import { applyVersionRevert } from './content-revert.ops';
import { allocateVersionNumber } from './content-version.ops';
import type { ContentQueryDto } from './dto/content-query.dto';
import type { UniqueCheck } from './validation/content-validation.types';
import { assertUniqueFields } from './validation/unique-field.guard';

export type VersionWithAuthor = ContentEntryVersion & {
  savedBy: Pick<User, 'id' | 'firstName' | 'lastName'>;
};

export type EntryAuthor = Pick<User, 'id' | 'firstName' | 'lastName'>;

/**
 * `createdBy` is only loaded by the read paths that present an entry; write paths
 * that return the row straight from a transaction leave it undefined.
 */
export type EntryWithLocale = ContentEntry & {
  locales: ContentEntryLocale[];
  createdBy?: EntryAuthor | null;
};

const AUTHOR_SELECT = { select: { id: true, firstName: true, lastName: true } } as const;

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
      trashedAt: null,
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.contentEntry.findMany({
        where,
        include: {
          locales: query.locale ? { where: { localeCode: query.locale } } : true,
          createdBy: AUTHOR_SELECT,
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      this.prisma.contentEntry.count({ where }),
    ]);

    return { items: items as EntryWithLocale[], total };
  }

  /**
   * Entry lookups are always bound to the content type from the route so an ID
   * belonging to another type cannot be read or mutated through it.
   */
  findByIdForType(
    id: string,
    contentTypeId: string,
    locale?: string,
  ): Promise<EntryWithLocale | null> {
    return this.prisma.contentEntry.findFirst({
      where: { id, contentTypeId },
      include: {
        locales: locale ? { where: { localeCode: locale } } : true,
        createdBy: AUTHOR_SELECT,
      },
    }) as Promise<EntryWithLocale | null>;
  }

  async findActiveLocaleCodes(): Promise<string[]> {
    const locales = await this.prisma.locale.findMany({
      where: { isActive: true },
      select: { code: true },
    });
    return locales.map((l) => l.code);
  }

  getLocaleFallbackChain(localeCode: string): Promise<string[]> {
    return resolveLocaleFallbackChain(this.prisma, localeCode);
  }

  async findByIdWithFallbackForType(
    id: string,
    contentTypeId: string,
    locale: string,
  ): Promise<EntryWithLocale | null> {
    const chain = await this.getLocaleFallbackChain(locale);
    const entry = await this.prisma.contentEntry.findFirst({
      where: { id, contentTypeId },
      include: { locales: { where: { localeCode: { in: chain } } }, createdBy: AUTHOR_SELECT },
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
    uniqueChecks: UniqueCheck[] = [],
  ): Promise<EntryWithLocale> {
    const extraLocales = extraLocaleCodes
      .filter((code) => code !== locale)
      .map((code) => ({
        localeCode: code,
        slug: `${slug}-${code}`,
        data: {} as Prisma.InputJsonValue,
      }));

    return this.prisma.$transaction(async (tx) => {
      await assertUniqueFields(tx, contentTypeId, uniqueChecks, null);
      return tx.contentEntry.create({
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
    });
  }

  update(
    id: string,
    contentTypeId: string,
    locale: string,
    data: Record<string, unknown>,
    uniqueChecks: UniqueCheck[] = [],
    slug?: string,
  ): Promise<EntryWithLocale> {
    return this.prisma.$transaction(async (tx) => {
      await tx.contentEntry.findFirstOrThrow({
        where: { id, contentTypeId },
        select: { id: true },
      });
      await assertUniqueFields(tx, contentTypeId, uniqueChecks, id);
      return tx.contentEntry.update({
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
              update: {
                data: data as Prisma.InputJsonValue,
                ...(slug !== undefined ? { slug } : {}),
              },
            },
          },
        },
        include: { locales: true },
      }) as Promise<EntryWithLocale>;
    });
  }

  addLocale(
    id: string,
    contentTypeId: string,
    locale: string,
    slug: string,
    data: Record<string, unknown>,
    uniqueChecks: UniqueCheck[] = [],
  ): Promise<EntryWithLocale> {
    return this.prisma.$transaction(async (tx) => {
      await tx.contentEntry.findFirstOrThrow({
        where: { id, contentTypeId },
        select: { id: true },
      });
      await assertUniqueFields(tx, contentTypeId, uniqueChecks, id);
      return tx.contentEntry.update({
        where: { id },
        data: {
          locales: {
            create: { localeCode: locale, slug, data: data as Prisma.InputJsonValue },
          },
        },
        include: { locales: true },
      }) as Promise<EntryWithLocale>;
    });
  }

  /**
   * Rewrites one locale's slug on its own. Returns false when the entry does not
   * belong to the content type or has no row for that locale.
   */
  async updateSlug(
    id: string,
    contentTypeId: string,
    locale: string,
    slug: string,
  ): Promise<boolean> {
    const owned = await this.prisma.contentEntry.findFirst({
      where: { id, contentTypeId },
      select: { id: true },
    });
    if (!owned) return false;
    const result = await this.prisma.contentEntryLocale.updateMany({
      where: { entryId: id, localeCode: locale },
      data: { slug },
    });
    return result.count > 0;
  }

  /** Returns false when the ID does not belong to the given content type. */
  async updateStatus(
    id: string,
    contentTypeId: string,
    status: ContentStatus,
    publishedAt?: Date,
  ): Promise<boolean> {
    const result = await this.prisma.contentEntry.updateMany({
      where: { id, contentTypeId },
      data: { status, publishedAt: publishedAt ?? null },
    });
    return result.count > 0;
  }

  async updateSchedule(
    id: string,
    contentTypeId: string,
    scheduledAt: Date | null,
    status: ContentStatus,
  ): Promise<boolean> {
    const result = await this.prisma.contentEntry.updateMany({
      where: { id, contentTypeId },
      data: { scheduledAt, status },
    });
    return result.count > 0;
  }

  /** `trashedByUserId` is what lets the trash screen name who deleted a row. */
  async trash(id: string, contentTypeId: string, trashedByUserId?: string): Promise<boolean> {
    const result = await this.prisma.contentEntry.updateMany({
      where: { id, contentTypeId },
      data: { status: 'TRASHED', trashedAt: new Date(), trashedByUserId: trashedByUserId ?? null },
    });
    return result.count > 0;
  }

  async createVersion(
    entryId: string,
    data: Record<string, unknown>,
    localesData: Record<string, unknown>,
    savedById: string,
    status: ContentStatus,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const versionNumber = await allocateVersionNumber(tx, entryId);
      await tx.contentEntryVersion.create({
        data: {
          entryId,
          versionNumber,
          status,
          data: data as Prisma.InputJsonValue,
          localesData: localesData as Prisma.InputJsonValue,
          savedById,
        },
      });
    });
  }

  async listVersions(
    entryId: string,
    limit: number,
    cursor?: string,
  ): Promise<{ items: VersionWithAuthor[]; total: number }> {
    const where = { entryId };
    const [items, total] = await Promise.all([
      this.prisma.contentEntryVersion.findMany({
        where,
        include: { savedBy: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { versionNumber: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      this.prisma.contentEntryVersion.count({ where }),
    ]);
    return { items: items as VersionWithAuthor[], total };
  }

  findVersionByIdForType(
    entryId: string,
    contentTypeId: string,
    versionId: string,
  ): Promise<VersionWithAuthor | null> {
    return this.prisma.contentEntryVersion.findFirst({
      where: { id: versionId, entryId, entry: { contentTypeId } },
      include: { savedBy: { select: { id: true, firstName: true, lastName: true } } },
    }) as Promise<VersionWithAuthor | null>;
  }

  revertToVersion(
    entryId: string,
    contentTypeId: string,
    version: VersionWithAuthor,
    userId: string,
    uniqueChecks: UniqueCheck[] = [],
  ): Promise<EntryWithLocale> {
    return this.prisma.$transaction((tx) =>
      applyVersionRevert(tx, { entryId, contentTypeId, version, userId, uniqueChecks }),
    );
  }
}

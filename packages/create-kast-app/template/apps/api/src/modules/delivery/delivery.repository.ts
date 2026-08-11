import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// The public payload carries resolved media URLs, never internal MediaFile ids —
// anonymous callers cannot resolve ids via /media/:id.
const SEO_SELECT = {
  metaTitle: true,
  metaDescription: true,
  ogTitle: true,
  ogDescription: true,
  ogImage: { select: { url: true } },
  noIndex: true,
  noFollow: true,
  canonicalUrl: true,
} as const;

export type PublishedEntryRow = {
  id: string;
  publishedAt: Date | null;
  seoMeta: Prisma.SeoMetaGetPayload<{ select: typeof SEO_SELECT }> | null;
  locales: { slug: string; data: Prisma.JsonValue }[];
};

@Injectable()
export class DeliveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(
    contentTypeId: string,
    locale: string,
    limit: number,
    order: 'asc' | 'desc',
    cursor?: string,
  ): Promise<{ items: PublishedEntryRow[]; total: number }> {
    const where: Prisma.ContentEntryWhereInput = {
      contentTypeId,
      status: 'PUBLISHED',
      trashedAt: null,
      locales: { some: { localeCode: locale } },
    };
    const [items, total] = await Promise.all([
      this.prisma.contentEntry.findMany({
        where,
        select: {
          id: true,
          publishedAt: true,
          seoMeta: { select: SEO_SELECT },
          locales: { where: { localeCode: locale }, select: { slug: true, data: true } },
        },
        orderBy: { publishedAt: order },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      this.prisma.contentEntry.count({ where }),
    ]);
    return { items, total };
  }

  async findPublishedBySlug(
    contentTypeId: string,
    slug: string,
    locale: string,
  ): Promise<PublishedEntryRow | null> {
    const entry = await this.prisma.contentEntry.findFirst({
      where: {
        contentTypeId,
        status: 'PUBLISHED',
        trashedAt: null,
        locales: { some: { localeCode: locale, slug } },
      },
      select: {
        id: true,
        publishedAt: true,
        seoMeta: { select: SEO_SELECT },
        locales: { where: { localeCode: locale }, select: { slug: true, data: true } },
      },
    });
    return entry;
  }

  /** Returns id -> url for the media files that exist and are not trashed. */
  async findMediaUrls(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.mediaFile.findMany({
      where: { id: { in: ids }, trashedAt: null },
      select: { id: true, url: true },
    });
    return new Map(rows.map((r) => [r.id, r.url]));
  }
}

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const SEO_SELECT = {
  metaTitle: true,
  metaDescription: true,
  ogTitle: true,
  ogDescription: true,
  ogImageId: true,
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
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PaginatedResult } from '../../common/types/auth.types';
import { ContentTypesService } from '../content-types/content-types.service';
import type { MenuDetail } from '../menus/menu.repository';
import { MenuService } from '../menus/menu.service';
import { SeoService } from '../seo/seo.service';
import { buildSitemapXml } from '../seo/sitemap.builder';
import { SettingsService } from '../settings/settings.service';
import { DeliveryRepository, type PublishedEntryRow } from './delivery.repository';

export interface DeliveryEntry {
  id: string;
  slug: string;
  publishedAt: string | null;
  data: unknown;
  seoMeta: {
    metaTitle: string | null;
    metaDescription: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    ogImageId: string | null;
    noIndex: boolean;
    noFollow: boolean;
    canonicalUrl: string | null;
  } | null;
}

@Injectable()
export class DeliveryService {
  constructor(
    private readonly repo: DeliveryRepository,
    private readonly contentTypes: ContentTypesService,
    private readonly menus: MenuService,
    private readonly settings: SettingsService,
    private readonly seo: SeoService,
  ) {}

  private toEntry(row: PublishedEntryRow): DeliveryEntry {
    const locale = row.locales[0];
    return {
      id: row.id,
      slug: locale?.slug ?? '',
      publishedAt: row.publishedAt?.toISOString() ?? null,
      data: locale?.data ?? null,
      seoMeta: row.seoMeta
        ? {
            metaTitle: row.seoMeta.metaTitle,
            metaDescription: row.seoMeta.metaDescription,
            ogTitle: row.seoMeta.ogTitle,
            ogDescription: row.seoMeta.ogDescription,
            ogImageId: row.seoMeta.ogImageId,
            noIndex: row.seoMeta.noIndex,
            noFollow: row.seoMeta.noFollow,
            canonicalUrl: row.seoMeta.canonicalUrl,
          }
        : null,
    };
  }

  async listContent(
    typeSlug: string,
    locale: string | undefined,
    limit: number,
    order: 'asc' | 'desc',
    cursor?: string,
  ): Promise<PaginatedResult<DeliveryEntry>> {
    if (!locale) throw new BadRequestException('locale query parameter is required');
    const ct = await this.contentTypes.findByName(typeSlug);
    const { items, total } = await this.repo.listPublished(ct.id, locale, limit, order, cursor);
    const hasNextPage = items.length > limit;
    const page = hasNextPage ? items.slice(0, limit) : items;
    const nextCursor = hasNextPage ? (page[page.length - 1]?.id ?? null) : null;
    return {
      data: page.map((r) => this.toEntry(r)),
      meta: { total, limit, cursor: nextCursor, hasNextPage },
    };
  }

  async getContentBySlug(
    typeSlug: string,
    slug: string,
    locale: string | undefined,
  ): Promise<{ data: DeliveryEntry }> {
    if (!locale) throw new BadRequestException('locale query parameter is required');
    const ct = await this.contentTypes.findByName(typeSlug);
    const entry = await this.repo.findPublishedBySlug(ct.id, slug, locale);
    if (!entry) {
      throw new NotFoundException(`No published entry "${slug}" for locale "${locale}"`);
    }
    return { data: this.toEntry(entry) };
  }

  async getMenu(slug: string): Promise<{ data: MenuDetail }> {
    const menu = await this.menus.findBySlug(slug);
    return { data: menu };
  }

  async getPublicSettings(): Promise<{ data: Record<string, unknown> }> {
    return { data: await this.settings.getPublicSettings() };
  }

  async getSitemap(): Promise<string> {
    const entries = await this.seo.buildSitemapEntries();
    return buildSitemapXml(entries);
  }
}

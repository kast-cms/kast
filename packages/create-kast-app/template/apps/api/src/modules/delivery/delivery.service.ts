import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentFieldType } from '@prisma/client';
import type { PaginatedResult } from '../../common/types/auth.types';
import type { ContentTypeWithFields } from '../content-types/content-types.repository';
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
    ogImageUrl: string | null;
    noIndex: boolean;
    noFollow: boolean;
    canonicalUrl: string | null;
  } | null;
}

export interface DeliveryFieldSchema {
  name: string;
  type: ContentFieldType;
  required: boolean;
  localized: boolean;
}

export interface DeliveryTypeSchema {
  name: string;
  displayName: string;
  localized: boolean;
  fields: DeliveryFieldSchema[];
}

/**
 * `slug` is lifted onto the locale row by the editor but is also carried inside
 * `data` when the type has no slug field, and the starters read it from there.
 * `_seo` is the admin editor's private blob (it carries raw media ids) and is
 * never part of the published contract.
 */
const RESERVED_PUBLIC_KEYS = ['slug'] as const;

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

  /**
   * Anonymous callers get an allow-list of the type's visible fields: a value
   * written while a field was visible survives in stored data after the field is
   * flipped to hidden (the schema validator carries it forward), and keys left
   * behind by deleted fields survive the same way.
   */
  private projectData(
    ct: ContentTypeWithFields,
    raw: unknown,
    mediaUrls: ReadonlyMap<string, string>,
  ): unknown {
    if (!isJsonObject(raw)) return raw ?? null;
    const out: Record<string, unknown> = {};
    for (const field of ct.fields) {
      if (field.isHidden || !Object.hasOwn(raw, field.name)) continue;
      const value = raw[field.name];
      out[field.name] =
        field.type === ContentFieldType.MEDIA ? this.resolveMedia(value, mediaUrls) : value;
    }
    for (const key of RESERVED_PUBLIC_KEYS) {
      if (!Object.hasOwn(out, key) && Object.hasOwn(raw, key)) out[key] = raw[key];
    }
    return out;
  }

  /** MEDIA fields store bare MediaFile ids; the public payload carries URLs only. */
  private resolveMedia(value: unknown, mediaUrls: ReadonlyMap<string, string>): unknown {
    if (typeof value === 'string') return mediaUrls.get(value) ?? null;
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === 'string' ? mediaUrls.get(item) : undefined))
        .filter((url): url is string => url !== undefined);
    }
    return null;
  }

  private collectMediaIds(value: unknown, into: Set<string>): void {
    if (typeof value === 'string') into.add(value);
    else if (Array.isArray(value)) {
      for (const item of value) if (typeof item === 'string') into.add(item);
    }
  }

  private async resolveMediaUrls(
    ct: ContentTypeWithFields,
    rows: PublishedEntryRow[],
  ): Promise<ReadonlyMap<string, string>> {
    const mediaFields = ct.fields.filter((f) => f.type === ContentFieldType.MEDIA && !f.isHidden);
    if (mediaFields.length === 0) return new Map();
    const ids = new Set<string>();
    for (const row of rows) {
      const data = row.locales[0]?.data;
      if (!isJsonObject(data)) continue;
      for (const field of mediaFields) this.collectMediaIds(data[field.name], ids);
    }
    return this.repo.findMediaUrls([...ids]);
  }

  private toEntry(
    row: PublishedEntryRow,
    ct: ContentTypeWithFields,
    mediaUrls: ReadonlyMap<string, string>,
  ): DeliveryEntry {
    const locale = row.locales[0];
    return {
      id: row.id,
      slug: locale?.slug ?? '',
      publishedAt: row.publishedAt?.toISOString() ?? null,
      data: this.projectData(ct, locale?.data ?? null, mediaUrls),
      seoMeta: row.seoMeta
        ? {
            metaTitle: row.seoMeta.metaTitle,
            metaDescription: row.seoMeta.metaDescription,
            ogTitle: row.seoMeta.ogTitle,
            ogDescription: row.seoMeta.ogDescription,
            ogImageUrl: row.seoMeta.ogImage?.url ?? null,
            noIndex: row.seoMeta.noIndex,
            noFollow: row.seoMeta.noFollow,
            canonicalUrl: row.seoMeta.canonicalUrl,
          }
        : null,
    };
  }

  // Public schema projection: name/type/required/localized only. Ids, config
  // and defaultValue can carry internal endpoints or credentials, and hidden
  // fields are not part of the published contract.
  private toSchema(ct: ContentTypeWithFields): DeliveryTypeSchema {
    return {
      name: ct.name,
      displayName: ct.displayName,
      localized: ct.isLocalized,
      fields: ct.fields
        .filter((f) => !f.isHidden)
        .map((f) => ({
          name: f.name,
          type: f.type,
          required: f.isRequired,
          localized: f.isLocalized,
        })),
    };
  }

  async listSchemas(): Promise<{ data: DeliveryTypeSchema[] }> {
    const types = await this.contentTypes.findAll();
    return { data: types.map((ct) => this.toSchema(ct)) };
  }

  async getSchema(typeSlug: string): Promise<{ data: DeliveryTypeSchema }> {
    const ct = await this.contentTypes.findByName(typeSlug);
    return { data: this.toSchema(ct) };
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
    const mediaUrls = await this.resolveMediaUrls(ct, page);
    return {
      data: page.map((r) => this.toEntry(r, ct, mediaUrls)),
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
    const mediaUrls = await this.resolveMediaUrls(ct, [entry]);
    return { data: this.toEntry(entry, ct, mediaUrls) };
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

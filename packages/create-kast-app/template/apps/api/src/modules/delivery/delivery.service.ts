import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentFieldType } from '@prisma/client';
import type { PaginatedResult } from '../../common/types/auth.types';
import type { ContentTypeWithFields } from '../content-types/content-types.repository';
import { ContentTypesService } from '../content-types/content-types.service';
import type { MenuDetail, MenuItemRecord } from '../menus/menu.repository';
import { MenuService } from '../menus/menu.service';
import type { PublicRedirect } from '../seo/seo.repository';
import { SeoService } from '../seo/seo.service';
import { buildSitemapXml } from '../seo/sitemap.builder';
import { SettingsService } from '../settings/settings.service';
import { DeliveryRepository, type PublishedEntryRow } from './delivery.repository';

export interface DeliveryEntry {
  id: string;
  slug: string;
  publishedAt: string | null;
  data: unknown;
  seoMeta: DeliverySeoMeta | null;
}

export interface DeliverySeoMeta {
  metaTitle: string | null;
  metaDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  noIndex: boolean;
  noFollow: boolean;
  canonicalUrl: string | null;
}

/** Site-wide fallbacks an entry inherits when it defines no meta of its own. */
interface SiteMetaDefaults {
  defaultMetaTitle: string | null;
  defaultMetaDescription: string | null;
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

export interface DeliveryMenuItem {
  label: string;
  url: string | null;
  target: string | null;
  children: DeliveryMenuItem[];
}

export interface DeliveryMenu {
  name: string;
  slug: string;
  localeCode: string | null;
  items: DeliveryMenuItem[];
}

/**
 * `slug` is lifted onto the locale row by the editor but is also carried inside
 * `data` when the type has no slug field, and the starters read it from there.
 * `_seo` is the admin editor's private blob (it carries raw media ids) and is
 * never part of the published contract.
 */
const RESERVED_PUBLIC_KEYS = ['slug'] as const;

/** A blank or whitespace-only stored value means "unset", the same as null. */
function blank(value: string | null | undefined): string | null {
  return value && value.trim() !== '' ? value : null;
}

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
    relations: ReadonlyMap<string, { id: string; type: string; slug: string }>,
  ): unknown {
    if (!isJsonObject(raw)) return raw ?? null;
    const out: Record<string, unknown> = {};
    for (const field of ct.fields) {
      if (field.isHidden || !Object.hasOwn(raw, field.name)) continue;
      const value = raw[field.name];
      out[field.name] = this.projectFieldValue(field.type, value, mediaUrls, relations);
    }
    for (const key of RESERVED_PUBLIC_KEYS) {
      if (!Object.hasOwn(out, key) && Object.hasOwn(raw, key)) out[key] = raw[key];
    }
    return out;
  }

  private projectFieldValue(
    type: ContentFieldType,
    value: unknown,
    mediaUrls: ReadonlyMap<string, string>,
    relations: ReadonlyMap<string, { id: string; type: string; slug: string }>,
  ): unknown {
    if (type === ContentFieldType.MEDIA) return this.resolveMedia(value, mediaUrls);
    if (type === ContentFieldType.RELATION) return this.resolveRelation(value, relations);
    return value;
  }

  private resolveRelation(
    value: unknown,
    relations: ReadonlyMap<string, { id: string; type: string; slug: string }>,
  ): unknown {
    if (typeof value === 'string') return relations.get(value) ?? null;
    if (Array.isArray(value)) {
      return value.flatMap((item) =>
        typeof item === 'string' && relations.has(item) ? [relations.get(item)] : [],
      );
    }
    return null;
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

  private async resolveRelations(
    ct: ContentTypeWithFields,
    rows: PublishedEntryRow[],
    locale: string,
  ): Promise<ReadonlyMap<string, { id: string; type: string; slug: string }>> {
    const fields = ct.fields.filter(
      (field) => field.type === ContentFieldType.RELATION && !field.isHidden,
    );
    const ids = new Set<string>();
    for (const row of rows) {
      const data = row.locales[0]?.data;
      if (!isJsonObject(data)) continue;
      for (const field of fields) this.collectMediaIds(data[field.name], ids);
    }
    return this.repo.findPublishedRelations([...ids], locale);
  }

  private toEntry(
    row: PublishedEntryRow,
    ct: ContentTypeWithFields,
    mediaUrls: ReadonlyMap<string, string>,
    relations: ReadonlyMap<string, { id: string; type: string; slug: string }>,
    siteMeta: SiteMetaDefaults,
  ): DeliveryEntry {
    const locale = row.locales[0];
    return {
      id: row.id,
      slug: locale?.slug ?? '',
      publishedAt: row.publishedAt?.toISOString() ?? null,
      data: this.projectData(ct, locale?.data ?? null, mediaUrls, relations),
      seoMeta: this.toSeoMeta(row, siteMeta),
    };
  }

  /**
   * Applies the site-wide fallback title and description.
   *
   * The SEO score is computed against the *effective* meta, so an entry that
   * inherits the site default scores as having a title. Returning the stored
   * row verbatim shipped a null title to the front end for that same entry —
   * the score and the payload disagreed. An entry with no SeoMeta row at all
   * still gets the defaults, which is the common case for a fresh install.
   */
  private toSeoMeta(row: PublishedEntryRow, siteMeta: SiteMetaDefaults): DeliverySeoMeta | null {
    const meta = row.seoMeta;
    // `blank()`, not `??`: the scoring side treats '' as absent and lets the site
    // default apply, so using `??` here would serve an empty <title> for an entry
    // that scored as having one. SeoService.upsertMeta now stores null instead of
    // '', but rows written before that still exist. Both ends must agree.
    const metaTitle = blank(meta?.metaTitle) ?? siteMeta.defaultMetaTitle;
    const metaDescription = blank(meta?.metaDescription) ?? siteMeta.defaultMetaDescription;
    if (!meta) {
      if (metaTitle === null && metaDescription === null) return null;
      return {
        metaTitle,
        metaDescription,
        ogTitle: null,
        ogDescription: null,
        ogImageUrl: null,
        noIndex: false,
        noFollow: false,
        canonicalUrl: null,
      };
    }
    return {
      metaTitle,
      metaDescription,
      ogTitle: meta.ogTitle,
      ogDescription: meta.ogDescription,
      ogImageUrl: meta.ogImage?.url ?? null,
      noIndex: meta.noIndex,
      noFollow: meta.noFollow,
      canonicalUrl: meta.canonicalUrl,
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

  private toPublicMenuItem(item: MenuItemRecord): DeliveryMenuItem {
    return {
      label: item.label,
      url: item.url,
      target: item.target,
      children: item.children
        .filter((child) => child.isActive)
        .map((child) => this.toPublicMenuItem(child)),
    };
  }

  private toPublicMenu(menu: MenuDetail): DeliveryMenu {
    return {
      name: menu.name,
      slug: menu.slug,
      localeCode: menu.localeCode,
      items: menu.items.filter((item) => item.isActive).map((item) => this.toPublicMenuItem(item)),
    };
  }

  async listSchemas(): Promise<{ data: DeliveryTypeSchema[] }> {
    const types = await this.contentTypes.findPubliclyDiscoverable();
    return { data: types.map((ct) => this.toSchema(ct)) };
  }

  async getSchema(typeSlug: string): Promise<{ data: DeliveryTypeSchema }> {
    const ct = await this.contentTypes.findPubliclyDiscoverableByName(typeSlug);
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
    const [mediaUrls, relations, siteMeta] = await Promise.all([
      this.resolveMediaUrls(ct, page),
      this.resolveRelations(ct, page, locale),
      this.seo.getSiteMetaDefaults(),
    ]);
    return {
      data: page.map((r) => this.toEntry(r, ct, mediaUrls, relations, siteMeta)),
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
    const [mediaUrls, relations, siteMeta] = await Promise.all([
      this.resolveMediaUrls(ct, [entry]),
      this.resolveRelations(ct, [entry], locale),
      this.seo.getSiteMetaDefaults(),
    ]);
    return { data: this.toEntry(entry, ct, mediaUrls, relations, siteMeta) };
  }

  async getMenu(slug: string): Promise<{ data: DeliveryMenu }> {
    const menu = await this.menus.findBySlug(slug);
    return { data: this.toPublicMenu(menu) };
  }

  async getPublicSettings(): Promise<{ data: Record<string, unknown> }> {
    return { data: await this.settings.getPublicSettings() };
  }

  listRedirects(): Promise<{ data: PublicRedirect[] }> {
    return this.seo.listPublicRedirects();
  }

  async getSitemap(): Promise<string> {
    const entries = await this.seo.buildSitemapEntries();
    return buildSitemapXml(entries);
  }
}

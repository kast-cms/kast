import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redirect, SeoMeta } from '@prisma/client';
import { Queue } from 'bullmq';
import type { PaginationDto } from '../../common/dto/pagination.dto';
import type { PaginatedResult } from '../../common/types/auth.types';
import { parseCsv, toCsvRow } from '../../common/utils/csv.util';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../queue/queue.constants';
import type { CreateRedirectDto, UpdateRedirectDto } from './dto/redirect.dto';
import type { UpsertSeoMetaDto } from './dto/seo-meta.dto';
import { parseRedirectRows } from './redirect-import';
import {
  checkBodyDocuments,
  checkCanonical,
  checkDescription,
  checkOgImage,
  checkSiteDefaults,
  checkSlug,
  checkTitle,
  computeScore,
  selectBodyDocuments,
} from './seo-checks';
import { blankTextToNull } from './seo-meta.normalize';
import {
  checkRedirectTarget,
  resolveGatePolicy,
  type SeoGatePolicy,
  type SeoSettings,
} from './seo-settings';
import { buildEntryUrl } from './seo-url.util';
import type { SeoJobData } from './seo.processor';
import {
  SeoRepository,
  type PublicRedirect,
  type SeoIssueInput,
  type SeoMetaFull,
  type SeoScoreWithIssues,
} from './seo.repository';
import type { SitemapEntry } from './sitemap.builder';

/** A redirect table is operator-authored; beyond this an import is a memory sink. */
export const MAX_REDIRECT_IMPORT_ROWS = 10_000;

export interface SeoValidationResult {
  score: number;
  issues: SeoIssueInput[];
  /** Blocking subsets: empty unless the content type's gate policy is `enforce`. */
  errors: SeoIssueInput[];
  warnings: SeoIssueInput[];
  policy?: SeoGatePolicy;
}

interface SeoMetaValues {
  metaTitle: string | null;
  metaDescription: string | null;
  ogImageId: string | null;
  canonicalUrl: string | null;
}

interface EffectiveMeta extends SeoMetaValues {
  titleFromSiteDefault: boolean;
  descriptionFromSiteDefault: boolean;
}

function withSiteDefault(
  own: string | null | undefined,
  fallback: string | null,
): { value: string | null; fromSiteDefault: boolean } {
  if (own) return { value: own, fromSiteDefault: false };
  return { value: fallback, fromSiteDefault: fallback !== null };
}

/** Applies the saved site-wide fallbacks to an entry that defines none of its own. */
function resolveEffectiveMeta(meta: SeoMetaValues | null, settings: SeoSettings): EffectiveMeta {
  const title = withSiteDefault(meta?.metaTitle, settings.defaultMetaTitle);
  const description = withSiteDefault(meta?.metaDescription, settings.defaultMetaDescription);
  return {
    metaTitle: title.value,
    metaDescription: description.value,
    ogImageId: meta?.ogImageId ?? null,
    canonicalUrl: meta?.canonicalUrl ?? null,
    titleFromSiteDefault: title.fromSiteDefault,
    descriptionFromSiteDefault: description.fromSiteDefault,
  };
}

interface EntryAnalysisTarget {
  exists: boolean;
  contentTypeName: string | undefined;
  fields: { name: string; type: string }[];
  slug: string | undefined;
  data: unknown;
}

function describeEntry(
  entry: {
    contentType: { name: string; fields: { name: string; type: string }[] };
    locales: { slug: string; data: unknown }[];
  } | null,
): EntryAnalysisTarget {
  if (!entry) {
    return { exists: false, contentTypeName: undefined, fields: [], slug: undefined, data: null };
  }
  const locale = entry.locales[0];
  return {
    exists: true,
    contentTypeName: entry.contentType.name,
    fields: entry.contentType.fields,
    slug: locale?.slug,
    data: locale?.data ?? null,
  };
}

/** Splits issues into the subsets that block a publish under the given policy. */
function splitBlockingIssues(
  issues: SeoIssueInput[],
  policy: SeoGatePolicy,
): { errors: SeoIssueInput[]; warnings: SeoIssueInput[] } {
  if (policy !== 'enforce') return { errors: [], warnings: [] };
  return {
    errors: issues.filter((i) => i.severity === 'ERROR'),
    warnings: issues.filter((i) => i.severity === 'WARNING'),
  };
}

/** Runs every SEO check against an entry's meta + primary locale. */
function gatherSeoIssues(
  meta: EffectiveMeta,
  slug: string | undefined,
  body: { hasBodyField: boolean; documents: unknown[] },
): SeoIssueInput[] {
  return [
    ...checkTitle(meta.metaTitle),
    ...checkDescription(meta.metaDescription),
    ...checkSiteDefaults(meta),
    ...checkOgImage(meta.ogImageId),
    ...checkCanonical(meta.canonicalUrl),
    ...checkSlug(slug),
    // A content type with no rich-text field has no body to score.
    ...(body.hasBodyField ? checkBodyDocuments(body.documents) : []),
  ];
}

@Injectable()
export class SeoService {
  private readonly defaultSiteUrl: string;

  constructor(
    private readonly repo: SeoRepository,
    private readonly prisma: PrismaService,
    config: ConfigService<Env>,
    @InjectQueue(QUEUE_NAMES.SEO) private readonly seoQueue: Queue<SeoJobData>,
  ) {
    this.defaultSiteUrl = (
      config.get('SITE_URL', { infer: true }) ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  /**
   * Runs SEO validation synchronously for an entry and persists a SeoScore,
   * creating the SeoMeta row when the entry has none so a validated entry always
   * has a score to read back. Missing meta values stay "missing" issues so
   * publish is still gated. `errors`/`warnings` carry only what the entry's
   * content type actually blocks on — see `resolveGatePolicy`.
   */
  async validateNow(entryId: string): Promise<SeoValidationResult> {
    const [meta, entry, settings] = await Promise.all([
      this.repo.findMeta(entryId),
      this.prisma.contentEntry.findUnique({
        where: { id: entryId },
        include: {
          locales: { take: 1 },
          contentType: { select: { name: true, fields: { select: { name: true, type: true } } } },
        },
      }),
      this.repo.findSeoSettings(),
    ]);

    const target = describeEntry(entry);
    const body = selectBodyDocuments(target.fields, target.data);
    const policy = resolveGatePolicy(settings, target.contentTypeName, body.hasBodyField);
    if (policy === 'disabled') {
      return { score: 100, issues: [], errors: [], warnings: [], policy };
    }

    const issues = gatherSeoIssues(resolveEffectiveMeta(meta, settings), target.slug, body);
    const score = computeScore(issues);
    // A score row needs a SeoMeta parent, and only an existing entry can have one.
    if (target.exists) await this.persistScore(entryId, meta?.id, score, issues);

    return { score, issues, ...splitBlockingIssues(issues, policy), policy };
  }

  private async persistScore(
    entryId: string,
    metaId: string | undefined,
    score: number,
    issues: SeoIssueInput[],
  ): Promise<void> {
    const parentId = metaId ?? (await this.repo.ensureMeta(entryId)).id;
    await this.repo.saveScore(parentId, score, issues);
  }

  /**
   * Stores a blank text field as NULL, so "cleared" has exactly one
   * representation (SEO-04).
   *
   * Two layers disagreed about what empty means: `withSiteDefault` above falls
   * back on any falsy value, so a stored `''` scored as though it had a title,
   * while `DeliveryService.toSeoMeta` used `??` and shipped that `''` verbatim.
   * An entry whose title was cleared therefore scored 92, passed the `enforce`
   * publish gate, and then served an empty <title> — the score and the payload
   * describing different documents. Normalising on the way in collapses both to
   * the null the "missing" checks already handle, for every client rather than
   * only the ones that remember to send null.
   */
  async upsertMeta(entryId: string, dto: UpsertSeoMetaDto): Promise<SeoMeta> {
    return this.repo.upsertMeta(entryId, blankTextToNull(dto));
  }

  async getMeta(entryId: string): Promise<SeoMetaFull> {
    const meta = await this.repo.findMeta(entryId);
    if (!meta) throw new NotFoundException(`No SEO meta for entry ${entryId}`);
    return meta;
  }

  async getScore(entryId: string): Promise<SeoScoreWithIssues> {
    const score = await this.repo.findLatestScore(entryId);
    if (!score) throw new NotFoundException(`No SEO score for entry ${entryId}`);
    return score;
  }

  async getScoreHistory(
    entryId: string,
    limit: number,
    cursor?: string,
  ): Promise<PaginatedResult<SeoScoreWithIssues>> {
    const result = await this.repo.findScoreHistory(entryId, limit, cursor);
    if (!result) throw new NotFoundException(`No SEO meta for entry ${entryId}`);
    const hasNextPage = result.items.length > limit;
    const data = hasNextPage ? result.items.slice(0, limit) : result.items;
    const nextCursor = hasNextPage ? (data[data.length - 1]?.id ?? null) : null;
    return { data, meta: { total: result.total, limit, cursor: nextCursor, hasNextPage } };
  }

  /**
   * The fixed `jobId` deduplicates validations that are still waiting or
   * running, so hammering the endpoint for one entry does not queue N jobs.
   *
   * It must NOT outlive the run. BullMQ refuses an `add` whose jobId already
   * exists in ANY state, including completed and failed, and the queue-wide
   * defaults retain those (removeOnComplete: 1000 / removeOnFail: 5000). With
   * those defaults a fixed jobId makes validation a once-per-entry operation:
   * the API keeps answering 202 {queued:true} while the worker never runs
   * again, so an entry validated while the gate was `disabled` (which returns
   * before persisting a score) can never obtain one and GET /seo/score/:id
   * 404s forever. Re-validating after fixing a meta title was equally a no-op.
   *
   * Removing the job as soon as it settles frees the id for the next request
   * while preserving the in-flight dedupe.
   */
  async enqueueValidation(entryId: string): Promise<{ queued: boolean }> {
    await this.seoQueue.add(
      'validate',
      { entryId },
      { jobId: `seo-${entryId}`, removeOnComplete: true, removeOnFail: true },
    );
    return { queued: true };
  }

  /**
   * Builds sitemap entries with per-locale hreflang alternates. The default
   * locale lives at the bare path (`/blog/slug`); non-default locales are
   * prefixed with their code (`/ar/blog/slug`).
   */
  /**
   * The site-wide fallback title and description an entry inherits when it
   * defines none of its own. The delivery payload applies these so a public page
   * ships the value the SEO score was actually calculated against.
   */
  async getSiteMetaDefaults(): Promise<{
    defaultMetaTitle: string | null;
    defaultMetaDescription: string | null;
  }> {
    const settings = await this.repo.findSeoSettings();
    return {
      defaultMetaTitle: settings.defaultMetaTitle,
      defaultMetaDescription: settings.defaultMetaDescription,
    };
  }

  async buildSitemapEntries(): Promise<SitemapEntry[]> {
    const [entries, locales, savedSiteUrl] = await Promise.all([
      this.repo.findPublishedEntriesForSitemap(),
      this.repo.findActiveLocales(),
      this.repo.findGlobalSettingString('site.url'),
    ]);
    const siteUrl = (savedSiteUrl ?? this.defaultSiteUrl).replace(/\/$/, '');
    const defaultCode = locales.find((l) => l.isDefault)?.code ?? locales[0]?.code ?? 'en';
    const activeCodes = new Set(locales.map((l) => l.code));

    const result: SitemapEntry[] = [];
    for (const entry of entries) {
      const localeUrls = entry.locales
        .filter((l) => activeCodes.has(l.localeCode))
        .map((l) => ({
          hreflang: l.localeCode,
          href: buildEntryUrl(siteUrl, entry.contentTypeName, l.slug, l.localeCode, defaultCode),
        }));
      if (localeUrls.length === 0) continue;
      // Prefer the default-locale URL as the canonical <loc>.
      const primary = localeUrls.find((u) => u.hreflang === defaultCode) ?? localeUrls[0];
      if (!primary) continue;
      result.push({ loc: primary.href, lastmod: entry.updatedAt, alternates: localeUrls });
    }
    return result;
  }

  async listPublicRedirects(): Promise<{ data: PublicRedirect[] }> {
    return { data: await this.repo.findActiveRedirects() };
  }

  async listRedirects(query: PaginationDto): Promise<PaginatedResult<Redirect>> {
    return this.repo.findAllRedirects(query);
  }

  async createRedirect(dto: CreateRedirectDto, userId: string): Promise<Redirect> {
    await this.assertRedirectTargetAllowed(dto.toPath);
    return this.repo.createRedirect(dto, userId);
  }

  async updateRedirect(id: string, dto: UpdateRedirectDto): Promise<Redirect> {
    const existing = await this.repo.findRedirectById(id);
    if (!existing) throw new NotFoundException(`Redirect ${id} not found`);
    if (dto.toPath !== undefined) await this.assertRedirectTargetAllowed(dto.toPath);
    return this.repo.updateRedirect(id, dto);
  }

  /**
   * A redirect target may only leave the site when its host is listed in
   * `seo.redirects.allowedHosts`; without that policy the redirect table is an
   * open redirect for whatever serves the rules.
   */
  private async assertRedirectTargetAllowed(toPath: string): Promise<void> {
    const settings = await this.repo.findSeoSettings();
    const verdict = checkRedirectTarget(toPath, settings.redirectAllowedHosts);
    if (!verdict.ok) throw new BadRequestException(verdict.reason);
  }

  async deleteRedirect(id: string): Promise<void> {
    const existing = await this.repo.findRedirectById(id);
    if (!existing) throw new NotFoundException(`Redirect ${id} not found`);
    await this.repo.deleteRedirect(id);
  }

  /**
   * Imports redirects from a CSV buffer (columns: fromPath,toPath,type,isActive).
   * Duplicates (existing or repeated within the file) are skipped and reported;
   * malformed rows, and rows whose target the redirect policy refuses, are
   * returned with per-row reasons.
   */
  async importRedirects(
    csv: string,
    userId: string,
  ): Promise<{ imported: number; skipped: number; errors: { row: number; reason: string }[] }> {
    const rows = parseCsv(csv);
    if (rows.length === 0) return { imported: 0, skipped: 0, errors: [] };
    if (rows.length > MAX_REDIRECT_IMPORT_ROWS) {
      throw new BadRequestException(
        `A redirect import may contain at most ${MAX_REDIRECT_IMPORT_ROWS} rows`,
      );
    }

    const settings = await this.repo.findSeoSettings();
    const {
      valid,
      errors,
      skipped: dupSkipped,
    } = parseRedirectRows(rows, settings.redirectAllowedHosts);

    const existing = await this.repo.findExistingFromPaths(valid.map((v) => v.fromPath));
    const toInsert = valid.filter((v) => !existing.has(v.fromPath));
    const skipped = dupSkipped + (valid.length - toInsert.length);

    const imported = await this.repo.createManyRedirects(toInsert, userId);
    return { imported, skipped, errors };
  }

  async exportRedirectsCsv(): Promise<string> {
    const rows = await this.repo.findAllRedirectsForExport();
    const header = toCsvRow(['fromPath', 'toPath', 'type', 'isActive', 'hitCount']);
    const body = rows.map((r) => toCsvRow([r.fromPath, r.toPath, r.type, r.isActive, r.hitCount]));
    return [header, ...body].join('\n');
  }
}

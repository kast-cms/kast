import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
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
import {
  checkBody,
  checkCanonical,
  checkDescription,
  checkOgImage,
  checkSlug,
  checkTitle,
  computeScore,
} from './seo-checks';
import type { SeoJobData } from './seo.processor';
import {
  SeoRepository,
  type SeoIssueInput,
  type SeoMetaFull,
  type SeoScoreWithIssues,
} from './seo.repository';
import type { SitemapEntry } from './sitemap.builder';

export interface SeoValidationResult {
  score: number;
  issues: SeoIssueInput[];
  errors: SeoIssueInput[];
  warnings: SeoIssueInput[];
}

interface RedirectImportRow {
  fromPath: string;
  toPath: string;
  type: 'PERMANENT' | 'TEMPORARY';
  isActive: boolean;
}

type RedirectRowParse = { ok: true; value: RedirectImportRow } | { ok: false; reason: string };

const FALSEY = new Set(['false', '0', 'no']);

function parseRedirectRow(cols: string[]): RedirectRowParse {
  const fromPath = (cols[0] ?? '').trim();
  const toPath = (cols[1] ?? '').trim();
  const typeRaw = (cols[2] ?? 'PERMANENT').trim().toUpperCase();

  if (!fromPath || !toPath) return { ok: false, reason: 'Missing fromPath or toPath' };
  if (typeRaw !== 'PERMANENT' && typeRaw !== 'TEMPORARY') {
    return { ok: false, reason: `Invalid type "${typeRaw}"` };
  }
  const isActive = !FALSEY.has((cols[3] ?? 'true').trim().toLowerCase());
  return { ok: true, value: { fromPath, toPath, type: typeRaw, isActive } };
}

function parseRedirectRows(rows: string[][]): {
  valid: RedirectImportRow[];
  errors: { row: number; reason: string }[];
  skipped: number;
} {
  // Detect and drop a header row if present.
  const first = rows[0]?.map((c) => c.trim().toLowerCase()) ?? [];
  const startIdx = first[0] === 'frompath' || first.includes('frompath') ? 1 : 0;

  const valid: RedirectImportRow[] = [];
  const errors: { row: number; reason: string }[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (let i = startIdx; i < rows.length; i++) {
    const rowNum = i + 1;
    const parsed = parseRedirectRow(rows[i] ?? []);
    if (!parsed.ok) {
      errors.push({ row: rowNum, reason: parsed.reason });
      continue;
    }
    if (seen.has(parsed.value.fromPath)) {
      skipped++;
      errors.push({ row: rowNum, reason: 'Duplicate fromPath' });
      continue;
    }
    seen.add(parsed.value.fromPath);
    valid.push(parsed.value);
  }
  return { valid, errors, skipped };
}

/** Runs every SEO check against an entry's meta + primary locale. */
function gatherSeoIssues(
  meta: {
    metaTitle: string | null;
    metaDescription: string | null;
    ogImageId: string | null;
    canonicalUrl: string | null;
  } | null,
  slug: string | undefined,
  bodyData: unknown,
): SeoIssueInput[] {
  return [
    ...checkTitle(meta?.metaTitle ?? null),
    ...checkDescription(meta?.metaDescription ?? null),
    ...checkOgImage(meta?.ogImageId ?? null),
    ...checkCanonical(meta?.canonicalUrl ?? null),
    ...checkSlug(slug),
    ...checkBody(bodyData),
  ];
}

@Injectable()
export class SeoService {
  private readonly siteUrl: string;

  constructor(
    private readonly repo: SeoRepository,
    private readonly prisma: PrismaService,
    config: ConfigService<Env>,
    @InjectQueue(QUEUE_NAMES.SEO) private readonly seoQueue: Queue<SeoJobData>,
  ) {
    this.siteUrl = (config.get('SITE_URL', { infer: true }) ?? 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
  }

  /**
   * Runs SEO validation synchronously for an entry and persists a SeoScore.
   * Returns the computed score plus issues split by severity so callers (e.g.
   * the publish gate) can block on ERROR-severity issues. If no SeoMeta exists
   * yet it is treated as a set of "missing" issues so publish is still gated.
   */
  async validateNow(entryId: string): Promise<SeoValidationResult> {
    const [meta, entry] = await Promise.all([
      this.repo.findMeta(entryId),
      this.prisma.contentEntry.findUnique({
        where: { id: entryId },
        include: { locales: { take: 1 } },
      }),
    ]);

    const locale = entry?.locales[0];
    const issues = gatherSeoIssues(meta, locale?.slug, locale?.data ?? null);
    const score = computeScore(issues);

    if (meta) {
      await this.repo.saveScore(meta.id, score, issues);
    }

    return {
      score,
      issues,
      errors: issues.filter((i) => i.severity === 'ERROR'),
      warnings: issues.filter((i) => i.severity === 'WARNING'),
    };
  }

  async upsertMeta(entryId: string, dto: UpsertSeoMetaDto): Promise<SeoMeta> {
    return this.repo.upsertMeta(entryId, dto);
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

  async enqueueValidation(entryId: string): Promise<{ queued: boolean }> {
    await this.seoQueue.add('validate', { entryId }, { jobId: `seo-${entryId}` });
    return { queued: true };
  }

  /**
   * Builds sitemap entries with per-locale hreflang alternates. The default
   * locale lives at the bare path (`/blog/slug`); non-default locales are
   * prefixed with their code (`/ar/blog/slug`).
   */
  async buildSitemapEntries(): Promise<SitemapEntry[]> {
    const [entries, locales] = await Promise.all([
      this.repo.findPublishedEntriesForSitemap(),
      this.repo.findActiveLocales(),
    ]);
    const defaultCode = locales.find((l) => l.isDefault)?.code ?? locales[0]?.code ?? 'en';
    const activeCodes = new Set(locales.map((l) => l.code));

    const result: SitemapEntry[] = [];
    for (const entry of entries) {
      const localeUrls = entry.locales
        .filter((l) => activeCodes.has(l.localeCode))
        .map((l) => ({
          hreflang: l.localeCode,
          href: this.entryUrl(entry.contentTypeName, l.slug, l.localeCode, defaultCode),
        }));
      if (localeUrls.length === 0) continue;
      // Prefer the default-locale URL as the canonical <loc>.
      const primary = localeUrls.find((u) => u.hreflang === defaultCode) ?? localeUrls[0];
      if (!primary) continue;
      result.push({ loc: primary.href, lastmod: entry.updatedAt, alternates: localeUrls });
    }
    return result;
  }

  private entryUrl(
    contentTypeName: string,
    slug: string,
    localeCode: string,
    defaultCode: string,
  ): string {
    const prefix = localeCode === defaultCode ? '' : `/${localeCode}`;
    return `${this.siteUrl}${prefix}/${contentTypeName}/${slug}`;
  }

  async listRedirects(query: PaginationDto): Promise<PaginatedResult<Redirect>> {
    return this.repo.findAllRedirects(query);
  }

  async createRedirect(dto: CreateRedirectDto, userId: string): Promise<Redirect> {
    return this.repo.createRedirect(dto, userId);
  }

  async updateRedirect(id: string, dto: UpdateRedirectDto): Promise<Redirect> {
    const existing = await this.repo.findRedirectById(id);
    if (!existing) throw new NotFoundException(`Redirect ${id} not found`);
    return this.repo.updateRedirect(id, dto);
  }

  async deleteRedirect(id: string): Promise<void> {
    const existing = await this.repo.findRedirectById(id);
    if (!existing) throw new NotFoundException(`Redirect ${id} not found`);
    await this.repo.deleteRedirect(id);
  }

  /**
   * Imports redirects from a CSV buffer (columns: fromPath,toPath,type,isActive).
   * Duplicates (existing or repeated within the file) are skipped and reported;
   * malformed rows are returned with per-row reasons.
   */
  async importRedirects(
    csv: string,
    userId: string,
  ): Promise<{ imported: number; skipped: number; errors: { row: number; reason: string }[] }> {
    const rows = parseCsv(csv);
    if (rows.length === 0) return { imported: 0, skipped: 0, errors: [] };

    const { valid, errors, skipped: dupSkipped } = parseRedirectRows(rows);

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

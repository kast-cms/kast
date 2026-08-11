import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { ContentStatus } from '@prisma/client';
import type { PaginatedResult } from '../../common/types/auth.types';
import type { SeoValidationResult } from '../seo/seo.service';
import type { EntryWithLocale } from './content.repository';

/** Flattens an entry's locales into the shape stored on a version snapshot. */
export function snapshotLocales(entry: EntryWithLocale): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const loc of entry.locales) {
    out[loc.localeCode] = { slug: loc.slug, data: loc.data };
  }
  return out;
}

export function assertApplied(applied: boolean, id: string): void {
  if (!applied) throw new NotFoundException(`Content entry ${id} not found`);
}

/**
 * A trashed row stays readable — the trash screen and the restore path need it —
 * but writing to it through a content route would leave an entry marked DRAFT
 * (or PUBLISHED, webhook and all) while `trashedAt` still hides it everywhere.
 */
export function assertNotTrashed(entry: EntryWithLocale, id: string): void {
  if (entry.trashedAt === null) return;
  throw new ConflictException(
    `Content entry ${id} is in the trash; restore it with POST /api/v1/trash/content/${id}/restore`,
  );
}

/**
 * The SEO publish gate: ERROR-severity issues always block; WARNING-severity
 * issues block unless `force: true` is passed (API spec §4).
 */
export function assertSeoPublishable(validation: SeoValidationResult, force?: boolean): void {
  if (validation.errors.length > 0) {
    throw new UnprocessableEntityException({
      message: 'Publish blocked by SEO errors',
      code: 'SEO_VALIDATION_FAILED',
      issues: validation.errors,
      score: validation.score,
    });
  }
  if (validation.warnings.length > 0 && force !== true) {
    throw new UnprocessableEntityException({
      message: 'Publish blocked by SEO warnings. Pass force: true to override.',
      code: 'SEO_VALIDATION_WARNINGS',
      issues: validation.warnings,
      score: validation.score,
    });
  }
}

/** TRASHED is a state DELETE owns: it also stamps `trashedAt`, which a status write does not. */
export function assertWritableStatus(
  typeSlug: string,
  id: string,
  status: ContentStatus | undefined,
): void {
  if (status !== 'TRASHED') return;
  throw new UnprocessableEntityException(
    `Use DELETE /api/v1/content-types/${typeSlug}/entries/${id} to trash an entry; setting the status alone would leave it out of both the listings and the trash`,
  );
}

export function localeData(entry: EntryWithLocale, localeCode: string): Record<string, unknown> {
  const match = entry.locales.find((l) => l.localeCode === localeCode);
  return (match?.data ?? {}) as Record<string, unknown>;
}

export function writeLocale(entry: EntryWithLocale, requested?: string): string {
  return requested ?? entry.locales[0]?.localeCode ?? 'en';
}

/**
 * Turns a `limit + 1` window into a page. The extra row is what tells the caller
 * there is a next page; it is never returned.
 */
export function paginate<T extends { id: string }>(
  items: T[],
  total: number,
  limit: number,
): PaginatedResult<T> {
  const hasNextPage = items.length > limit;
  const data = hasNextPage ? items.slice(0, limit) : items;
  const cursor = hasNextPage ? (data[data.length - 1]?.id ?? null) : null;
  return { data, meta: { total, limit, cursor, hasNextPage } };
}

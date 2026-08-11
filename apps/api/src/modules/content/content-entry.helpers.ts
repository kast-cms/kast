import { NotFoundException } from '@nestjs/common';
import type { PaginatedResult } from '../../common/types/auth.types';
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

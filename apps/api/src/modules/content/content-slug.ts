import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

const MAX_SLUG_LENGTH = 200;

/**
 * The stored slug form: lower case, every run of non-alphanumeric characters
 * folded to a single hyphen, no leading or trailing hyphen. Unicode letters and
 * digits survive, so a non-Latin locale keeps a readable slug.
 * Returns '' when nothing usable is left.
 */
export function normalizeSlug(raw: string): string {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
}

/** Normalizes a slug the caller asked for; an unusable one is the caller's error. */
export function requireSlug(raw: string, source: string): string {
  const slug = normalizeSlug(raw);
  if (slug === '') {
    throw new BadRequestException(
      `${source} "${raw}" contains no slug-safe characters; supply letters or digits`,
    );
  }
  return slug;
}

/**
 * Fallback for an entry created without any slug. Random rather than clock-based:
 * two entries of the same type created in the same millisecond used to generate
 * the same slug and collide on the (localeCode, slug) unique index.
 */
export function generateSlug(typeSlug: string): string {
  const base = normalizeSlug(typeSlug) || 'entry';
  return `${base}-${randomBytes(6).toString('hex')}`;
}

/**
 * Resolves the slug for a write. Precedence: the explicit `slug` field of the
 * request, then a string `slug` inside `data`, then a generated one. An explicit
 * value that normalizes to nothing is rejected instead of being silently replaced.
 */
export function resolveEntrySlug(
  typeSlug: string,
  explicit: string | undefined,
  data: Record<string, unknown>,
): string {
  if (explicit !== undefined) return requireSlug(explicit, 'slug');
  const fromData = data['slug'];
  if (typeof fromData === 'string' && fromData.trim() !== '') {
    return requireSlug(fromData, 'data.slug');
  }
  return generateSlug(typeSlug);
}

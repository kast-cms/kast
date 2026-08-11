import type { UpsertSeoMetaDto } from './dto/seo-meta.dto';

/**
 * The text columns of SeoMeta. Booleans and the media foreign keys are left
 * alone — `''` is not a meaningful value for an id either, but blanking one is
 * a client bug that should surface rather than be quietly rewritten.
 */
const TEXT_FIELDS = [
  'metaTitle',
  'metaDescription',
  'ogTitle',
  'ogDescription',
  'twitterTitle',
  'twitterDesc',
  'canonicalUrl',
] as const satisfies readonly (keyof UpsertSeoMetaDto)[];

/**
 * Rewrites blank (and whitespace-only) text fields to `null` so a cleared field
 * has one canonical stored form.
 *
 * Keys that are absent stay absent: `upsertMeta` patches only what it is given,
 * and turning an omitted key into `null` would clear fields the caller never
 * mentioned.
 */
export function blankTextToNull(dto: UpsertSeoMetaDto): UpsertSeoMetaDto {
  const out: Record<string, unknown> = { ...dto };
  for (const field of TEXT_FIELDS) {
    const value = out[field];
    if (typeof value === 'string' && value.trim() === '') out[field] = null;
  }
  return out as UpsertSeoMetaDto;
}

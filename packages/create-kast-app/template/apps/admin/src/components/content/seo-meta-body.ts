import { clearable } from '@/lib/nullable-field';
import type { UpsertSeoMetaBody } from '@kast-cms/sdk';

/**
 * Turns the editor's SEO panel — plain strings, where "cleared" is '' — into the
 * body PUT /seo/meta expects.
 *
 * '' is not a clear: the API reads a blank meta title as "not set" and falls
 * back to the site-wide default when it scores the entry, while the delivery
 * payload keeps the empty string verbatim. A cleared title would score as
 * present and ship blank. null is the value that means cleared.
 *
 * `ogImage` is deliberately absent: the panel collects a URL while the API's
 * `ogImageId` is a MediaFile id, so it stays in the editor-only `_seo` block.
 */
export function buildSeoMetaBody(seo: Record<string, string>): UpsertSeoMetaBody {
  return {
    metaTitle: clearable(seo['metaTitle']),
    metaDescription: clearable(seo['metaDescription']),
    canonicalUrl: clearable(seo['canonicalUrl']),
  };
}

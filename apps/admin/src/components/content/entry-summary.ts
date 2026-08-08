import type { ContentEntrySummary } from '@kast-cms/sdk';

/**
 * Normalises a content-entry list row for display.
 *
 * `ContentEntrySummary` declares flat `titleField` / `locale` / `authorName`
 * fields, but the list endpoint actually returns the raw entry with a nested
 * `locales[]` array and none of those three. Nothing reconciles the two, so the
 * table fell back to `entry.id` and rendered opaque cuids in the Title column.
 *
 * This reads the documented fields when they are present and derives them from
 * `locales[0]` when they are not, so the UI is correct against either shape.
 * The mismatch itself is an API/SDK contract bug and belongs upstream; this
 * only stops the admin from displaying nonsense in the meantime.
 */

/** What the endpoint really sends — every documented field treated as optional. */
interface RawEntry {
  titleField?: string | null;
  locale?: string | null;
  authorName?: string | null;
  locales?: {
    localeCode?: string | null;
    slug?: string | null;
    data?: Record<string, unknown> | null;
  }[];
}

/** Field names to try, in order, when deriving a human-readable title. */
const TITLE_KEYS = ['title', 'name', 'heading', 'label', 'displayName'];

export interface EntryDisplay {
  title: string | null;
  locale: string | null;
  authorName: string | null;
}

/** First non-empty string among the candidate keys. */
function pickTitle(data: Record<string, unknown> | null | undefined): string | null {
  if (!data) return null;
  for (const key of TITLE_KEYS) {
    const value = data[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return null;
}

const nonEmpty = (value: string | null | undefined): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

export function toEntryDisplay(entry: ContentEntrySummary): EntryDisplay {
  const raw = entry as RawEntry;
  const primary = raw.locales?.[0];

  return {
    // Documented field → a title-ish field in the locale payload → the slug,
    // which is a poor title but still far better than a cuid.
    title: nonEmpty(raw.titleField) ?? pickTitle(primary?.data) ?? nonEmpty(primary?.slug),
    locale: nonEmpty(raw.locale) ?? nonEmpty(primary?.localeCode),
    authorName: nonEmpty(raw.authorName),
  };
}

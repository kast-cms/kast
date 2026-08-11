import type { ContentEntryLocale, ContentField, ContentStatus } from '@prisma/client';
import type { EntryAuthor, EntryWithLocale } from './content.repository';

/**
 * The management entry contract the SDK and admin are written against: the active
 * locale flattened onto the row. `locales` is kept alongside it so a caller that
 * needs every translation does not have to make a second request.
 */
export interface ContentEntryDetailResponse {
  id: string;
  contentTypeId: string;
  status: ContentStatus;
  locale: string | null;
  slug: string | null;
  data: Record<string, unknown>;
  authorId: string | null;
  authorName: string | null;
  isAiGenerated: boolean;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  trashedAt: Date | null;
  locales: ContentEntryLocale[];
}

export interface ContentEntrySummaryResponse extends ContentEntryDetailResponse {
  /** Value of the type's first TEXT field in the active locale, for list rows. */
  titleField: string | null;
}

function authorName(author: EntryAuthor | null | undefined): string | null {
  if (!author) return null;
  const name = `${author.firstName ?? ''} ${author.lastName ?? ''}`.trim();
  return name === '' ? null : name;
}

function activeLocale(
  entry: EntryWithLocale,
  requestedLocale?: string,
): ContentEntryLocale | undefined {
  if (requestedLocale !== undefined) {
    const exact = entry.locales.find((l) => l.localeCode === requestedLocale);
    if (exact) return exact;
  }
  return entry.locales[0];
}

export function toEntryDetail(
  entry: EntryWithLocale,
  requestedLocale?: string,
): ContentEntryDetailResponse {
  const locale = activeLocale(entry, requestedLocale);
  return {
    id: entry.id,
    contentTypeId: entry.contentTypeId,
    status: entry.status,
    locale: locale?.localeCode ?? null,
    slug: locale?.slug ?? null,
    data: (locale?.data ?? {}) as Record<string, unknown>,
    authorId: entry.createdById,
    authorName: authorName(entry.createdBy),
    isAiGenerated: entry.isAiGenerated,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    publishedAt: entry.publishedAt,
    scheduledAt: entry.scheduledAt,
    trashedAt: entry.trashedAt,
    locales: entry.locales,
  };
}

export function toEntrySummary(
  entry: EntryWithLocale,
  fields: ContentField[],
  requestedLocale?: string,
): ContentEntrySummaryResponse {
  const detail = toEntryDetail(entry, requestedLocale);
  const titleFieldName = fields.find((f) => f.type === 'TEXT')?.name;
  const value = titleFieldName === undefined ? undefined : detail.data[titleFieldName];
  return { ...detail, titleField: typeof value === 'string' ? value : null };
}

import { type DeliveryEntry, deliveryFetch } from '@/lib/kast';
import type {
  ChangelogData,
  ChangelogEntry,
  DocData,
  DocDetailEntry,
  DocEntry,
  SidebarCategory,
  TocHeading,
} from '@/types';

export const DOC_TYPE = 'doc-page';
export const CHANGELOG_TYPE = 'changelog-entry';

/** Pagination / locale params accepted by the list helpers. */
export interface ListParams {
  cursor?: string;
  limit?: string;
  locale?: string;
}

/** Surface the top-level `slug` inside a doc's `data` and derive timestamps. */
function normalizeDoc(entry: DeliveryEntry<DocData>): DocEntry {
  const ts = entry.publishedAt ?? new Date(0).toISOString();
  return {
    ...entry,
    data: { ...entry.data, slug: entry.data.slug ?? entry.slug },
    createdAt: ts,
    updatedAt: ts,
  };
}

/** Normalise a changelog entry: add derived timestamps. */
function normalizeChangelog(entry: DeliveryEntry<ChangelogData>): ChangelogEntry {
  const ts = entry.publishedAt ?? new Date(0).toISOString();
  return { ...entry, createdAt: ts, updatedAt: ts };
}

export async function getDocs(params: ListParams = {}): Promise<DocEntry[]> {
  try {
    const res = await deliveryFetch<{ data: DeliveryEntry<DocData>[] }>(`/content/${DOC_TYPE}`, {
      query: { limit: params.limit ?? '200', cursor: params.cursor },
      ...(params.locale !== undefined ? { locale: params.locale } : {}),
    });
    return res.data.map(normalizeDoc);
  } catch {
    return [];
  }
}

export async function getDocBySlug(
  categorySlug: string,
  slug: string,
): Promise<DocDetailEntry | null> {
  try {
    const res = await deliveryFetch<{ data: DeliveryEntry<DocData> }>(
      `/content/${DOC_TYPE}/${encodeURIComponent(slug)}`,
    );
    const doc = normalizeDoc(res.data);
    // The delivery slug lookup is keyed by slug only; ensure the category matches.
    if (doc.data.categorySlug !== categorySlug) return null;
    return doc;
  } catch {
    return null;
  }
}

export async function buildSidebar(): Promise<SidebarCategory[]> {
  const docs = await getDocs();
  const map = new Map<string, SidebarCategory>();

  for (const doc of docs) {
    const key = doc.data.categorySlug;
    if (!map.has(key)) {
      map.set(key, { name: doc.data.category, slug: doc.data.categorySlug, items: [] });
    }
    map.get(key)!.items.push({
      label: doc.data.title,
      slug: doc.data.slug,
      categorySlug: doc.data.categorySlug,
      order: doc.data.order ?? 0,
    });
  }

  for (const cat of map.values()) {
    cat.items.sort((a, b) => a.order - b.order);
  }

  return Array.from(map.values());
}

export async function getChangelog(params: ListParams = {}): Promise<{
  data: ChangelogEntry[];
  nextCursor?: string;
}> {
  try {
    const res = await deliveryFetch<{
      data: DeliveryEntry<ChangelogData>[];
      meta: { cursor: string | null };
    }>(`/content/${CHANGELOG_TYPE}`, {
      query: { limit: params.limit ?? '20', cursor: params.cursor },
      ...(params.locale !== undefined ? { locale: params.locale } : {}),
    });
    return {
      data: res.data.map(normalizeChangelog),
      ...(res.meta.cursor != null ? { nextCursor: res.meta.cursor } : {}),
    };
  } catch {
    return { data: [] };
  }
}

/**
 * Extracts H2 and H3 headings from rich-text HTML for a table of contents.
 */
export function extractToc(html: string): TocHeading[] {
  const headings: TocHeading[] = [];
  const re = /<(h[23])[^>]*>(.*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(html)) !== null) {
    const level = parseInt((match[1] ?? 'h2').replace('h', ''), 10) as 2 | 3;
    const text = (match[2] ?? '').replace(/<[^>]+>/g, '').trim();
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    headings.push({ id, text, level });
  }

  return headings;
}

/**
 * Injects id attributes into H2/H3 elements so TOC anchor links work.
 */
export function injectHeadingIds(html: string): string {
  return html.replace(/<(h[23])([^>]*)>(.*?)<\/\1>/gi, (_match, tag, attrs, content) => {
    const text = content.replace(/<[^>]+>/g, '').trim();
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `<${tag} id="${id}"${attrs}>${content}</${tag}>`;
  });
}

import { kast } from '@/lib/kast';
import type {
  DocEntry,
  DocDetailEntry,
  ChangelogEntry,
  SidebarCategory,
  TocHeading,
} from '@/types';
import type { EntryListParams } from '@kast/sdk';

export const DOC_TYPE = 'doc-page';
export const CHANGELOG_TYPE = 'changelog-entry';

export async function getDocs(params: EntryListParams = {}): Promise<DocEntry[]> {
  const res = await kast.content.list(DOC_TYPE, {
    status: 'PUBLISHED',
    limit: '200',
    ...params,
  });
  return res.data as DocEntry[];
}

export async function getDocBySlug(
  categorySlug: string,
  slug: string,
): Promise<DocDetailEntry | null> {
  const docs = await getDocs();
  const match = docs.find(
    (d) => d.data.categorySlug === categorySlug && d.data.slug === slug,
  );
  if (!match) return null;
  const detail = await kast.content.get(DOC_TYPE, match.id);
  return detail.data as DocDetailEntry;
}

export async function buildSidebar(): Promise<SidebarCategory[]> {
  const docs = await getDocs();
  const map = new Map<string, SidebarCategory>();

  for (const doc of docs) {
    const key = doc.data.categorySlug;
    if (!map.has(key)) {
      map.set(key, {
        name: doc.data.category,
        slug: doc.data.categorySlug,
        items: [],
      });
    }
    map.get(key)!.items.push({
      label: doc.data.title,
      slug: doc.data.slug,
      categorySlug: doc.data.categorySlug,
      order: doc.data.order ?? 0,
    });
  }

  // Sort items within each category by order
  for (const cat of map.values()) {
    cat.items.sort((a, b) => a.order - b.order);
  }

  return Array.from(map.values());
}

export async function getChangelog(params: EntryListParams = {}): Promise<{
  data: ChangelogEntry[];
  nextCursor?: string;
}> {
  const res = await kast.content.list(CHANGELOG_TYPE, {
    status: 'PUBLISHED',
    limit: '20',
    ...params,
  });
  return { data: res.data as ChangelogEntry[], nextCursor: res.nextCursor };
}

/**
 * Extracts H2 and H3 headings from rich-text HTML for a table of contents.
 * Adds id attributes to headings so in-page anchors work.
 */
export function extractToc(html: string): TocHeading[] {
  const headings: TocHeading[] = [];
  const re = /<(h[23])[^>]*>(.*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(html)) !== null) {
    const level = parseInt(match[1].replace('h', ''), 10) as 2 | 3;
    const text = match[2].replace(/<[^>]+>/g, '').trim();
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

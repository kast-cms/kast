import type { ContentEntryDetail, ContentEntrySummary } from '@kast/sdk';

/** Shape of a doc page's `data` field */
export interface DocData {
  title: string;
  slug: string;
  category: string;
  categorySlug: string;
  body: string;
  excerpt?: string;
  order?: number;
  publishedAt?: string;
}

/** Shape of a changelog entry's `data` field */
export interface ChangelogData {
  version: string;
  releasedAt: string;
  summary: string;
  body: string;
  type?: 'major' | 'minor' | 'patch' | 'security';
}

export type DocEntry = ContentEntrySummary & { data: DocData };
export type DocDetailEntry = ContentEntryDetail & { data: DocData };
export type ChangelogEntry = ContentEntrySummary & { data: ChangelogData };

/** Sidebar item built from doc entries */
export interface SidebarItem {
  label: string;
  slug: string;
  categorySlug: string;
  order: number;
}

/** Sidebar category group */
export interface SidebarCategory {
  name: string;
  slug: string;
  items: SidebarItem[];
}

/** TOC heading extracted from rich-text HTML */
export interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

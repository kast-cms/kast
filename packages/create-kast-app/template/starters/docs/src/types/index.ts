import type { DeliveryEntry } from '@/lib/kast';

/** Shape of a doc page's `data` field. */
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

/** Shape of a changelog entry's `data` field. */
export interface ChangelogData {
  version: string;
  releasedAt: string;
  summary: string;
  body: string;
  type?: 'major' | 'minor' | 'patch' | 'security';
}

/**
 * A published entry returned by the Delivery API, normalised for the UI.
 * `createdAt` / `updatedAt` are derived from the Delivery `publishedAt`.
 */
export type DeliveryUiEntry<TData> = DeliveryEntry<TData> & {
  createdAt: string;
  updatedAt: string;
};

export type DocEntry = DeliveryUiEntry<DocData>;
export type DocDetailEntry = DeliveryUiEntry<DocData>;
export type ChangelogEntry = DeliveryUiEntry<ChangelogData>;

/** Sidebar item built from doc entries. */
export interface SidebarItem {
  label: string;
  slug: string;
  categorySlug: string;
  order: number;
}

/** Sidebar category group. */
export interface SidebarCategory {
  name: string;
  slug: string;
  items: SidebarItem[];
}

/** TOC heading extracted from rich-text HTML. */
export interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

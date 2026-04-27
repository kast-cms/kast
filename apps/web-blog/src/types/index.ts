import type { ContentEntryDetail, ContentEntrySummary } from '@kast-cms/sdk';

/** Shape of a blog post's `data` field */
export interface PostData {
  title: string;
  slug: string;
  excerpt?: string;
  body: string;
  coverImage?: string;
  publishedAt?: string;
  author?: string;
  category?: string;
  tags?: string[];
  readTimeMinutes?: number;
}

/** Shape of a category's `data` field */
export interface CategoryData {
  name: string;
  slug: string;
  description?: string;
}

export type PostEntry = ContentEntrySummary & { data: PostData };
export type PostDetailEntry = ContentEntryDetail & { data: PostData };
export type CategoryEntry = ContentEntrySummary & { data: CategoryData };

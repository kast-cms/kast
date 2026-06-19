import type { DeliveryEntry } from '@/lib/kast';

/** Shape of a blog post's `data` field. */
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

/** Shape of a category's `data` field. */
export interface CategoryData {
  name: string;
  slug: string;
  description?: string;
}

/**
 * A published entry returned by the Delivery API, normalised for the UI.
 * `createdAt` / `updatedAt` are derived (the Delivery API exposes `publishedAt`),
 * so existing components can read either the top-level fields or `data.*`.
 */
export type DeliveryUiEntry<TData> = DeliveryEntry<TData> & {
  createdAt: string;
  updatedAt: string;
};

export type PostEntry = DeliveryUiEntry<PostData>;
export type PostDetailEntry = DeliveryUiEntry<PostData>;
export type CategoryEntry = DeliveryUiEntry<CategoryData>;

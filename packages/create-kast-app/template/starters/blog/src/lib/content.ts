import { type DeliveryEntry, deliveryFetch } from '@/lib/kast';
import type { CategoryData, CategoryEntry, PostData, PostDetailEntry, PostEntry } from '@/types';

export const BLOG_TYPE = 'blog-post';
export const CATEGORY_TYPE = 'blog-category';

/** Pagination / locale params accepted by the list helpers. */
export interface ListParams {
  cursor?: string;
  limit?: string;
  locale?: string;
}

/**
 * Normalise a post entry for UI consumption: surface the top-level `slug` /
 * `publishedAt` inside `data` (components read `post.data.slug`) and derive
 * `createdAt` / `updatedAt` from the Delivery `publishedAt`.
 */
function normalizePost(entry: DeliveryEntry<PostData>): PostEntry {
  const ts = entry.publishedAt ?? new Date(0).toISOString();
  return {
    ...entry,
    data: {
      ...entry.data,
      slug: entry.data.slug ?? entry.slug,
      ...(entry.publishedAt != null
        ? { publishedAt: entry.data.publishedAt ?? entry.publishedAt }
        : {}),
    },
    createdAt: ts,
    updatedAt: ts,
  };
}

/** Normalise a category entry: surface the top-level `slug` and add timestamps. */
function normalizeCategory(entry: DeliveryEntry<CategoryData>): CategoryEntry {
  const ts = entry.publishedAt ?? new Date(0).toISOString();
  return {
    ...entry,
    data: { ...entry.data, slug: entry.data.slug ?? entry.slug },
    createdAt: ts,
    updatedAt: ts,
  };
}

function buildQuery(params: ListParams, defaultLimit: string): Record<string, string | undefined> {
  return { limit: params.limit ?? defaultLimit, cursor: params.cursor };
}

export async function getPosts(
  params: ListParams = {},
): Promise<{ data: PostEntry[]; nextCursor?: string }> {
  try {
    const res = await deliveryFetch<{
      data: DeliveryEntry<PostData>[];
      meta: { cursor: string | null };
    }>(`/content/${BLOG_TYPE}`, {
      query: buildQuery(params, '10'),
      ...(params.locale !== undefined ? { locale: params.locale } : {}),
    });
    return {
      data: res.data.map(normalizePost),
      ...(res.meta.cursor != null ? { nextCursor: res.meta.cursor } : {}),
    };
  } catch {
    return { data: [] };
  }
}

export async function getPostBySlug(slug: string): Promise<PostDetailEntry | null> {
  try {
    const res = await deliveryFetch<{ data: DeliveryEntry<PostData> }>(
      `/content/${BLOG_TYPE}/${encodeURIComponent(slug)}`,
    );
    return normalizePost(res.data);
  } catch {
    return null;
  }
}

export async function getCategories(): Promise<CategoryEntry[]> {
  try {
    const res = await deliveryFetch<{ data: DeliveryEntry<CategoryData>[] }>(
      `/content/${CATEGORY_TYPE}`,
      { query: { limit: '100' } },
    );
    return res.data.map(normalizeCategory);
  } catch {
    return [];
  }
}

export async function getPostsByCategory(
  categorySlug: string,
  params: ListParams = {},
): Promise<{ data: PostEntry[]; nextCursor?: string }> {
  const { data, nextCursor } = await getPosts(params);
  // The Delivery API has no per-field filter, so filter by category client-side.
  const filtered = data.filter((p) => p.data.category === categorySlug);
  return { data: filtered, ...(nextCursor !== undefined ? { nextCursor } : {}) };
}

export function estimateReadTime(body: string): number {
  const wordsPerMinute = 200;
  const words = body.replace(/<[^>]*>/g, '').split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

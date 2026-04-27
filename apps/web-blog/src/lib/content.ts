import { kast } from '@/lib/kast';
import type { PostEntry, PostDetailEntry, CategoryEntry } from '@/types';
import type { EntryListParams } from '@kast/sdk';

export const BLOG_TYPE = 'blog-post';
export const CATEGORY_TYPE = 'blog-category';

export async function getPosts(
  params: EntryListParams = {},
): Promise<{ data: PostEntry[]; nextCursor?: string }> {
  const res = await kast.content.list(BLOG_TYPE, {
    status: 'PUBLISHED',
    limit: '10',
    ...params,
  });
  return { data: res.data as PostEntry[], nextCursor: res.nextCursor };
}

export async function getPostBySlug(slug: string): Promise<PostDetailEntry | null> {
  // List posts filtered by slug field
  const res = await kast.content.list(BLOG_TYPE, {
    status: 'PUBLISHED',
    limit: '1',
    // NOTE: slug filter requires the Kast API to support data field filtering
    // If not supported, fetch all and find by slug
  });
  const match = (res.data as PostEntry[]).find((p) => p.data.slug === slug);
  if (!match) return null;
  const detail = await kast.content.get(BLOG_TYPE, match.id);
  return detail.data as PostDetailEntry;
}

export async function getPostById(id: string): Promise<PostDetailEntry | null> {
  try {
    const res = await kast.content.get(BLOG_TYPE, id);
    return res.data as PostDetailEntry;
  } catch {
    return null;
  }
}

export async function getCategories(): Promise<CategoryEntry[]> {
  const res = await kast.content.list(CATEGORY_TYPE, {
    status: 'PUBLISHED',
    limit: '100',
  });
  return res.data as CategoryEntry[];
}

export async function getPostsByCategory(
  categorySlug: string,
  params: EntryListParams = {},
): Promise<{ data: PostEntry[]; nextCursor?: string }> {
  const res = await kast.content.list(BLOG_TYPE, {
    status: 'PUBLISHED',
    limit: '10',
    ...params,
  });
  // Filter by category (client-side until server-side filtering is available)
  const filtered = (res.data as PostEntry[]).filter((p) => p.data.category === categorySlug);
  return { data: filtered, nextCursor: res.nextCursor };
}

export function estimateReadTime(body: string): number {
  const wordsPerMinute = 200;
  const words = body.replace(/<[^>]*>/g, '').split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

import { getPosts } from '@/lib/content';
import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3002';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${siteUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ];

  // Add blog post URLs
  try {
    let cursor: string | undefined;
    do {
      const { data: posts, nextCursor } = await getPosts({
        ...(cursor !== undefined ? { cursor } : {}),
        limit: '100',
      });
      for (const post of posts) {
        urls.push({
          url: `${siteUrl}/blog/${post.data.slug}`,
          lastModified: new Date(post.updatedAt),
          changeFrequency: 'weekly',
          priority: 0.7,
        });
      }
      cursor = nextCursor;
    } while (cursor);
  } catch {
    // Fail silently — return partial sitemap
  }

  // Kast also serves a ready-made XML sitemap of every published entry at
  // `${KAST_API_URL}/api/v1/delivery/sitemap.xml` (CORS-exempt, no key required).
  // We build a frontend-relative sitemap here so URLs match this site's routes.

  return urls;
}

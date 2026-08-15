import { getDocs } from '@/lib/content';
import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3003';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    {
      url: `${siteUrl}/changelog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];

  try {
    const docs = await getDocs();
    for (const doc of docs) {
      urls.push({
        url: `${siteUrl}/docs/${doc.data.categorySlug}/${doc.data.slug}`,
        lastModified: new Date(doc.updatedAt),
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  } catch {
    // Fail silently
  }

  return urls;
}

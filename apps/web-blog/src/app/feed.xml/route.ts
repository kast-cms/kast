import { NextResponse } from 'next/server';
import { getPosts } from '@/lib/content';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3002';
const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'My Blog';
const siteDescription = process.env.NEXT_PUBLIC_SITE_DESCRIPTION ?? 'A blog powered by Kast CMS';

export const revalidate = 3600;

export async function GET() {
  const { data: posts } = await getPosts({ limit: '20' });

  const items = posts
    .map((post) => {
      const pubDate = post.data.publishedAt
        ? new Date(post.data.publishedAt).toUTCString()
        : new Date(post.createdAt).toUTCString();

      const title = post.data.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const description = (post.data.excerpt ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const link = `${siteUrl}/blog/${post.data.slug}`;

      return `
    <item>
      <title>${title}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>
      ${post.data.author ? `<author>${post.data.author}</author>` : ''}
      ${post.data.category ? `<category>${post.data.category}</category>` : ''}
    </item>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteName}</title>
    <link>${siteUrl}</link>
    <description>${siteDescription}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

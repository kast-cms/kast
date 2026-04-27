---
title: SEO
description: Read and update SEO metadata, scores, and sitemaps with the SDK.
sidebar:
  order: 6
---

## Get SEO metadata

```ts
const { data: seo } = await kast.seo.get(entryId);
// { metaTitle, metaDescription, canonicalUrl, ogTitle, score, issues, ... }
```

## Update SEO metadata

```ts
await kast.seo.update(entryId, {
  metaTitle: 'Hello World — My Blog',
  metaDescription: 'A quick intro to Kast CMS.',
  canonicalUrl: 'https://myblog.com/hello-world',
  ogTitle: 'Hello World',
  ogDescription: 'A quick intro.',
  ogImage: mediaFileId, // media file ID
  noIndex: false,
  structuredData: {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Hello World',
  },
});
```

## Get score only

```ts
const { data: score } = await kast.seo.getScore(entryId);
// { score: 85, issues: [] }
```

## Trigger re-validation

```ts
await kast.seo.validate(entryId);
// Enqueues kast.seo job; score updates asynchronously
```

## Get sitemap entries

```ts
const { data: entries } = await kast.seo.getSitemap();
// Array of { url, lastmod, changefreq, priority }
```

## List all SEO records

```ts
const { data: records } = await kast.seo.list({ sort: 'score:asc', limit: 50 });
// Good for finding pages that need SEO attention
```

## generateMetadata helper (Next.js)

```ts
// app/blog/[slug]/page.tsx
import { kast } from '@/lib/kast';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const { data: entries } = await kast.content.list('blog-post', {
    status: 'PUBLISHED',
    locale: 'en',
  });
  const entry = entries.find((e) => (e.data.slug as string) === params.slug);
  if (!entry) return {};

  const { data: seo } = await kast.seo.get(entry.id);

  return {
    title: seo.metaTitle,
    description: seo.metaDescription,
    openGraph: {
      title: seo.ogTitle ?? seo.metaTitle ?? undefined,
      description: seo.ogDescription ?? seo.metaDescription ?? undefined,
      images: seo.ogImageUrl ? [{ url: seo.ogImageUrl }] : [],
    },
    robots: seo.noIndex ? { index: false } : undefined,
  };
}
```

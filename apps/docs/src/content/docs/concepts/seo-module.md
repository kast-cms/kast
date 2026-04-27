---
title: SEO Module
description: Automatic SEO scoring, sitemaps, canonical URLs, and OG metadata for every content entry.
---

Kast's SEO module is built into the core — not a plugin. Every published entry gets an automatic SEO score, and the API serves ready-to-use sitemaps, robots.txt, and OG metadata.

## SEO score

When an entry is published, the `kast.seo` BullMQ queue validates it against a checklist:

| Check                                      | Points |
| ------------------------------------------ | ------ |
| `metaTitle` present and 30–60 chars        | 20     |
| `metaDescription` present and 50–160 chars | 20     |
| `canonicalUrl` set                         | 15     |
| `ogImage` set                              | 15     |
| At least one heading in rich text body     | 10     |
| No broken internal links                   | 10     |
| `alt` text on all images                   | 10     |

Maximum score: 100. Scores appear in the admin panel's SEO Manager and Dashboard.

## SEO metadata per entry

Each entry can have a dedicated SEO block:

```bash
PATCH /api/v1/seo/entries/:entryId
Authorization: Bearer <token>

{
  "metaTitle": "Hello World — My Blog",
  "metaDescription": "A quick intro to Kast CMS.",
  "canonicalUrl": "https://myblog.com/blog/hello-world",
  "ogTitle": "Hello World",
  "ogDescription": "A quick intro to Kast CMS.",
  "ogImage": "<media-file-id>",
  "structuredData": { "@type": "Article", ... },
  "noIndex": false
}
```

Fetch SEO metadata for a frontend:

```bash
GET /api/v1/seo/entries/:entryId
```

## Sitemap

```bash
GET /api/v1/seo/sitemap.xml
```

Returns an XML sitemap of all `PUBLISHED` entries. Update frequency and priority are derived from the entry's `updatedAt` timestamp.

## Robots.txt

Robots.txt content is managed via **Global Settings → SEO**. It is served at:

```bash
GET /robots.txt
```

## OG defaults

Set fallback OG metadata in **Global Settings → SEO**:

- `seo.defaultMetaTitle` — appended as a suffix to all page titles
- `seo.defaultMetaDescription` — used when no entry-level description is set

## SDK usage

```ts
// Get SEO score and issues for an entry
const { data: score } = await kast.seo.getScore(entryId);
// { score: 75, issues: ['ogImage missing'] }

// Update SEO metadata
await kast.seo.update(entryId, {
  metaTitle: 'Hello World — My Blog',
  metaDescription: 'A quick intro to Kast CMS.',
});

// Fetch sitemap entries
const { data: entries } = await kast.seo.getSitemap();
```

## Next.js integration

Use the SEO metadata from Kast in `generateMetadata`:

```ts
// app/blog/[slug]/page.tsx
export async function generateMetadata({ params }) {
  const { data: entry } = await kast.content.getBySlug('blog-post', params.slug);
  const { data: seo } = await kast.seo.getScore(entry.id);

  return {
    title: seo.metaTitle ?? entry.data.title,
    description: seo.metaDescription,
    openGraph: {
      title: seo.ogTitle,
      description: seo.ogDescription,
      images: seo.ogImageUrl ? [seo.ogImageUrl] : [],
    },
  };
}
```

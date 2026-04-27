---
title: SEO API
description: SEO metadata, scores, sitemaps, and robots.txt.
---

## Get SEO metadata for an entry

```http
GET /api/v1/seo/entries/:entryId
```

**Response:**

```json
{
  "data": {
    "entryId": "clxyz...",
    "metaTitle": "Hello World — My Blog",
    "metaDescription": "A quick intro.",
    "canonicalUrl": "https://myblog.com/hello-world",
    "ogTitle": "Hello World",
    "ogDescription": "A quick intro.",
    "ogImageUrl": "https://cdn.example.com/og.jpg",
    "noIndex": false,
    "score": 85,
    "issues": []
  }
}
```

## Update SEO metadata

```http
PATCH /api/v1/seo/entries/:entryId
Authorization: Bearer <token>

{
  "metaTitle": "Hello World — My Blog",
  "metaDescription": "A quick intro to Kast CMS.",
  "canonicalUrl": "https://myblog.com/hello-world",
  "ogImage": "<media-file-id>",
  "noIndex": false,
  "structuredData": { "@type": "Article" }
}
```

## Get SEO score

```http
GET /api/v1/seo/entries/:entryId/score
Authorization: Bearer <token>
```

```json
{
  "data": {
    "score": 75,
    "issues": ["ogImage missing", "metaDescription under 50 characters"]
  }
}
```

## Trigger SEO re-validation

```http
POST /api/v1/seo/entries/:entryId/validate
Authorization: Bearer <token>
```

Enqueues a `kast.seo` job. Score is updated asynchronously.

## Sitemap

```http
GET /api/v1/seo/sitemap.xml
```

Returns `Content-Type: application/xml`. No authentication required.

## Robots.txt

```http
GET /robots.txt
```

Content managed via Global Settings → SEO.

## List all SEO records

```http
GET /api/v1/seo
Authorization: Bearer <token>
?sort=score:asc&limit=50
```

Returns all entries with their SEO scores, sorted by score ascending — useful for finding pages that need attention.

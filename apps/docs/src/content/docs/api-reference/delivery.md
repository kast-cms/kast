---
title: Delivery API (Public)
description: The public, read-only content delivery endpoints used by frontends to fetch published content.
---

The **Delivery API** is the public, read-only surface of Kast. Frontends (Next.js, Nuxt, Astro, mobile apps) fetch **published** content from `/api/v1/delivery/*` — there is no need for an account or admin token.

All delivery endpoints pass through Kast's three security layers (CORS → rate limit → auth). Authentication is **never required**, but a read-only [delivery API key](/api-reference/authentication/) (`X-Kast-Key`) is optional: when present, the CORS origin check is bypassed and a higher rate-limit ceiling applies. This is the recommended pattern for trusted server-side callers such as SSR.

| Endpoint                                   | CORS                    | Rate limit                     | Auth                         |
| ------------------------------------------ | ----------------------- | ------------------------------ | ---------------------------- |
| `GET /api/v1/delivery/content/:type`       | allowed origins checked | 100/min IP · 1000/min with key | none · optional `X-Kast-Key` |
| `GET /api/v1/delivery/content/:type/:slug` | allowed origins checked | 100/min IP · 1000/min with key | none · optional `X-Kast-Key` |
| `GET /api/v1/delivery/menus/:slug`         | allowed origins checked | 100/min IP · 1000/min with key | none · optional `X-Kast-Key` |
| `GET /api/v1/delivery/settings`            | allowed origins checked | 100/min IP · 1000/min with key | none · optional `X-Kast-Key` |
| `GET /api/v1/delivery/sitemap.xml`         | always open (exempt)    | 200/min                        | never                        |

Only entries with `status = PUBLISHED` are returned. Drafts, scheduled, archived, and trashed entries are never exposed here — to read those, use the authenticated [Content Entries API](/api-reference/content-entries/).

## List published entries

```http
GET /api/v1/delivery/content/:type?locale=en
```

**Query parameters:**

| Param    | Type            | Default | Description                            |
| -------- | --------------- | ------- | -------------------------------------- |
| `locale` | string          | —       | **Required.** Locale code (e.g. `en`)  |
| `limit`  | number          | `20`    | Page size (max `100`)                  |
| `cursor` | string          | —       | Pagination cursor from previous `meta` |
| `order`  | `asc` \| `desc` | `desc`  | Sort by `publishedAt`                  |

**Response:**

```json
{
  "data": [
    {
      "id": "clentry001",
      "slug": "hello-world",
      "publishedAt": "2026-04-20T08:00:00.000Z",
      "data": {
        "title": "Hello World",
        "body": "<p>Content here</p>",
        "heroImage": { "id": "clmedia001", "url": "https://cdn.example.com/image.jpg" }
      },
      "seoMeta": {
        "metaTitle": "Hello World | Blog",
        "metaDescription": "A hello world post",
        "ogTitle": null,
        "ogImageUrl": null,
        "noIndex": false
      }
    }
  ],
  "meta": { "total": 42, "limit": 20, "cursor": "clentry010", "hasNextPage": true }
}
```

## Get a single published entry

```http
GET /api/v1/delivery/content/:type/:slug?locale=en
```

Looks up one published entry by its locale-specific `slug`. The `locale` query param is **required**. Returns the same entry shape as the list endpoint, wrapped in `{ "data": ... }`. Returns `404` if no published entry matches the slug in that locale.

## Get a menu

```http
GET /api/v1/delivery/menus/:slug?locale=en
```

Returns a navigation menu with its full item tree, ready to render. `locale` is optional.

```json
{
  "data": {
    "id": "clmenu001",
    "name": "Main Navigation",
    "slug": "main-nav",
    "items": [
      {
        "id": "clmi001",
        "label": "Home",
        "url": "/",
        "target": "_self",
        "position": 0,
        "children": []
      },
      {
        "id": "clmi002",
        "label": "Blog",
        "url": "/blog",
        "target": "_self",
        "position": 1,
        "children": [
          {
            "id": "clmi003",
            "label": "Latest Posts",
            "url": "/blog/latest",
            "position": 0,
            "children": []
          }
        ]
      }
    ]
  }
}
```

## Get public settings

```http
GET /api/v1/delivery/settings
```

Returns the public subset of global settings (site name, description, logo, etc.) as a flat key/value map.

```json
{
  "data": {
    "site.name": "My Kast Site",
    "site.description": "A website powered by Kast CMS",
    "site.logoUrl": "https://cdn.example.com/logo.svg"
  }
}
```

## Content schema

```http
GET /api/v1/delivery/schema
GET /api/v1/delivery/schema/:type
```

Returns the public field schema for every content type, or for one type.
Cached for 60 seconds (`Cache-Control: public, max-age=60`). An unknown type
returns `404`.

Only safe metadata is exposed — fields marked hidden are omitted entirely, as
are internal properties such as `id`, `config` and `defaultValue` (which can
carry internal URLs or credentials).

```json
{
  "data": {
    "name": "blog-post",
    "displayName": "Blog Post",
    "localized": true,
    "fields": [{ "name": "title", "type": "TEXT", "required": true, "localized": true }]
  }
}
```

:::note
This endpoint discloses the shape of every content type to anonymous callers.
That is intentional for typed frontends, but it is a deliberate disclosure —
there is no per-type opt-out today.
:::

## Sitemap

```http
GET /api/v1/delivery/sitemap.xml
```

An auto-generated XML sitemap of every published entry across all locales, with `hreflang` alternates. This endpoint is **always open** (CORS-exempt, never requires a key) so search-engine crawlers can reach it.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://example.com/blog/hello-world</loc>
    <lastmod>2026-04-20</lastmod>
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/blog/hello-world"/>
    <xhtml:link rel="alternate" hreflang="ar" href="https://example.com/ar/blog/مرحبا-بالعالم"/>
  </url>
</urlset>
```

## Using the SDK

The [`@kast-cms/sdk`](/sdk/installation/) client targets the authenticated admin endpoints. For purely public consumption you can call the delivery endpoints directly with `fetch` — see [Connecting a frontend](/getting-started/connecting-a-frontend/) for a complete, typed example.

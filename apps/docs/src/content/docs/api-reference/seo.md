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

Returns `Content-Type: application/xml`. No authentication required. For public, crawler-facing use, the same sitemap is also served (CORS-exempt) from the [Delivery API](/api-reference/delivery/) at `GET /api/v1/delivery/sitemap.xml`.

## Robots.txt

```http
GET /api/v1/robots.txt
```

Serves the `robots.txt` setting verbatim (Global Settings → Security), cached for
60 seconds. Falls back to allow-all when nothing is saved.

## The publish gate

Publishing runs the SEO checks and, depending on the policy for that content
type, can refuse the publish with `422`.

| Policy     | Behaviour                                                   |
| ---------- | ----------------------------------------------------------- |
| `enforce`  | Score, persist, and block while an ERROR-level issue stands |
| `advisory` | Score and persist, but never block                          |
| `disabled` | Skip analysis entirely                                      |

Resolution order: the content type's entry in `seo.gate.contentTypes`, then
`seo.gate.defaultPolicy`, then a built-in heuristic — **enforce** for a type that
has a rich-text body field, **advisory** for one that does not. That keeps
page-like types protected while taxonomy-style types stop blocking out of the
box.

:::caution
A page-like type built entirely from block or component fields, with no
rich-text field, falls to `advisory` under the heuristic. Give it an explicit
`seo.gate.contentTypes` entry of `enforce`.
:::

`PublishContentDto.force` overrides WARNING-level issues; ERROR-level issues
under `enforce` always block.

## Site-wide meta defaults

`seo.defaultMetaTitle` and `seo.defaultMetaDescription` are applied to any entry
that defines none of its own. They are used both when scoring — so inheriting the
default is reported as an INFO issue, never an error — and in the Delivery API
payload, so the score and what the front end receives agree.

## Redirects

Redirect targets are policy-checked on write (create, update, and per row on CSV
import):

- Site-relative paths (`/new-path`) are always allowed.
- Protocol-relative (`//host`) and `/\host` are refused — browsers follow both
  off-site.
- Non-http(s) schemes (`javascript:`, `data:`, `mailto:`), bare relative paths
  and empty targets are refused.
- An absolute `http(s)` target is allowed only when its hostname appears in the
  `seo.redirects.allowedHosts` setting, which defaults to empty.

Existing rows are not rewritten; the check applies on write.

There is no collection route at `GET /api/v1/seo`. Use the per-entry score and
score-history routes above; the admin obtains entry IDs from the content API.

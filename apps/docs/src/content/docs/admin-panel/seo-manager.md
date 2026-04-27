---
title: SEO Manager
description: Monitor SEO scores across all content and fix issues from the admin panel.
---

The SEO Manager gives `EDITOR+` users a bird's-eye view of SEO health across all published content.

## Score overview

The SEO Manager page (`/admin/seo`) shows:

- **Distribution chart** — count of entries scoring below 50, 50–74, and 75+
- **Entries list** — sorted by score ascending (lowest scores first) to surface issues quickly

Each row shows:

- Entry title and content type
- Current SEO score (0–100) with a colour-coded badge
- Missing items — e.g. "ogImage missing", "metaDescription too short"
- **Edit SEO** button — opens the SEO panel for that entry

## Fixing SEO issues

Click **Edit SEO** on any entry to open the SEO edit panel:

| Field            | Guidance                                                           |
| ---------------- | ------------------------------------------------------------------ |
| Meta Title       | 30–60 characters. Include the main keyword.                        |
| Meta Description | 50–160 characters. Summarise the page clearly.                     |
| Canonical URL    | Full URL including `https://`. Prevents duplicate content.         |
| OG Title         | Defaults to Meta Title if left blank.                              |
| OG Description   | Defaults to Meta Description if left blank.                        |
| OG Image         | Select an image from the media library. 1200×630px recommended.    |
| No Index         | Toggle on for pages you don't want indexed (e.g. thank-you pages). |

Click **Save** to persist and **Re-validate** to trigger a fresh score calculation.

## Sitemap

Click **View Sitemap** to preview the generated `sitemap.xml`. The sitemap includes all `PUBLISHED` entries and updates automatically when entries are published or unpublished.

Direct URL: `GET /api/v1/seo/sitemap.xml`

## Robots.txt

Edit the robots.txt content in **Global Settings → SEO → Robots.txt**. The content is served at `/robots.txt` with `Content-Type: text/plain`.

## Structured data

Each entry's SEO panel includes a **Structured Data** field for a JSON-LD object. This is passed through directly — no transformation. Example for an Article:

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Hello World",
  "datePublished": "2026-01-01",
  "author": { "@type": "Person", "name": "Oday Bakkour" }
}
```

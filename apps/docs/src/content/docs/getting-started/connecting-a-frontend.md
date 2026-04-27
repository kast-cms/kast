---
title: Connecting a Frontend
description: Fetch Kast content in your Next.js, Nuxt, or any frontend using the SDK or REST API.
sidebar:
  order: 5
---

## Using @kast/sdk (recommended)

Install the SDK in your frontend project:

```bash
npm install @kast/sdk
# or
pnpm add @kast/sdk
```

### Initialize the client

```ts
import { KastClient } from '@kast/sdk';

const kast = new KastClient({
  baseUrl: process.env.NEXT_PUBLIC_KAST_API_URL ?? 'http://localhost:3000',
  apiKey: process.env.KAST_DELIVERY_API_KEY, // public delivery key
});
```

Use `apiKey` (via `X-Kast-Key` header) for public read-only access to published content. Use `accessToken` for authenticated write operations.

### Fetch published entries

```ts
const { data: posts } = await kast.content.list('blog-post', {
  status: 'PUBLISHED',
  locale: 'en',
  limit: 10,
});
```

### Fetch a single entry

```ts
const { data: post } = await kast.content.get('blog-post', entryId, { locale: 'en' });
```

### Next.js App Router example

```tsx
// app/blog/page.tsx
import { KastClient } from '@kast/sdk';

const kast = new KastClient({ baseUrl: process.env.KAST_API_URL! });

export default async function BlogPage() {
  const { data: posts } = await kast.content.list('blog-post', {
    status: 'PUBLISHED',
    limit: 10,
  });

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.data.title as string}</li>
      ))}
    </ul>
  );
}
```

## Using the REST API directly

If you prefer not to use the SDK:

```bash
GET /api/v1/content-types/blog-post/entries?status=PUBLISHED
X-Kast-Key: your-delivery-api-key
```

All responses follow the envelope format:

```json
{
  "data": [...],
  "meta": { "total": 42, "cursor": "clxyz..." }
}
```

## Delivery API key

A delivery API key (`X-Kast-Key`) grants read-only access to published content. Create one in the admin panel:

1. Go to **Settings** → **API Tokens**.
2. Click **New Token** → type: **Delivery**.
3. Copy the token — it's shown only once.

Delivery tokens can only `GET` published entries, media, SEO metadata, forms, and menus. They cannot create, update, or delete anything.

## Frontend starter templates

The `create-kast-app` CLI can scaffold a ready-to-use Next.js frontend alongside your Kast instance:

```
◆ Include frontend starter? Blog template
```

This creates `apps/web-blog/` or `apps/web-docs/` with:

- Pages pre-wired to the Kast delivery API via `@kast/sdk`
- SEO metadata from `generateMetadata`
- Sitemap and RSS feed
- Navigation from Kast menus
- Tailwind CSS v4 + dark mode

Run both together:

```bash
pnpm dev  # starts API, admin, and web starter concurrently
```

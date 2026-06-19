---
title: Connecting a Frontend
description: Fetch Kast content in your Next.js, Nuxt, or any frontend using the SDK or REST API.
sidebar:
  order: 5
---

## Using @kast-cms/sdk (recommended)

Install the SDK in your frontend project:

```bash
npm install @kast-cms/sdk
# or
pnpm add @kast-cms/sdk
```

### Initialize the client

```ts
import { KastClient } from '@kast-cms/sdk';

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
import { KastClient } from '@kast-cms/sdk';

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

## Using the public Delivery API directly

For a purely public frontend you don't even need the SDK — fetch published content straight from the [Delivery API](/api-reference/delivery/) with a typed helper:

```ts
// lib/kast.ts
const API = process.env.KAST_API_URL ?? 'http://localhost:3000';
const KEY = process.env.KAST_API_KEY; // optional read-only delivery key
const LOCALE = process.env.KAST_LOCALE ?? 'en';

async function delivery<T>(path: string): Promise<T> {
  const res = await fetch(`${API}/api/v1/delivery${path}`, {
    headers: KEY ? { 'X-Kast-Key': KEY } : {},
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Kast ${res.status}`);
  return res.json() as Promise<T>;
}

export const getPosts = () => delivery<{ data: Post[] }>(`/content/blog-post?locale=${LOCALE}`);

export const getPost = (slug: string) =>
  delivery<{ data: Post }>(`/content/blog-post/${slug}?locale=${LOCALE}`);

export const getMenu = (slug: string) =>
  delivery<{ data: Menu }>(`/menus/${slug}?locale=${LOCALE}`);
```

All responses follow the envelope format:

```json
{
  "data": [...],
  "meta": { "total": 42, "limit": 20, "cursor": "clxyz...", "hasNextPage": true }
}
```

The `locale` query param is **required** on `/delivery/content/*`. See the [Delivery API reference](/api-reference/delivery/) for every endpoint.

## Delivery API key

A delivery API key (`X-Kast-Key`) is optional. On the public delivery endpoints it grants higher rate limits and bypasses CORS for trusted server-side callers. Create one in the admin panel:

1. Go to **Settings** → **API Tokens**.
2. Click **New Token** → type: **Delivery** (read-only).
3. Copy the token — it's shown only once.

Delivery tokens can only `GET` published content; they cannot create, update, or delete anything.

## Frontend starter templates

The `create-kast-app` CLI can scaffold a ready-to-use Next.js frontend alongside your Kast instance:

```
◆ Include frontend starter? Blog template
```

This creates `apps/web-blog/` or `apps/web-docs/` with:

- Pages pre-wired to the Kast delivery API via `@kast-cms/sdk`
- SEO metadata from `generateMetadata`
- Sitemap and RSS feed
- Navigation from Kast menus
- Tailwind CSS v4 + dark mode

Run both together:

```bash
pnpm dev  # starts API, admin, and web starter concurrently
```

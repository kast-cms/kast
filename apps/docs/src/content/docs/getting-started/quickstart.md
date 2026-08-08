---
title: Docker Compose Quickstart
description: Get a full Kast CMS stack running locally in under 5 minutes.
sidebar:
  order: 2
---

This guide takes you from zero to a running Kast instance with a super-admin account and your first content.

## 1. Create the project

```bash
npx create-kast-app my-blog
cd my-blog
```

The generated `.env` is pre-configured for local development and Docker Compose.
Review `JWT_SECRET` before production.

## 2. Start services

```bash
docker compose up
```

Docker starts PostgreSQL, Redis, the API, and the admin panel. The API runs
pending Prisma migrations before it starts. Wait for:

```
kast-api   | [Nest] Application is running on: http://localhost:3000
kast-admin | ✓ Ready in 2.3s
```

## 3. Create your admin account

Open **http://localhost:3001/admin**. On a fresh install you'll see the setup wizard:

1. Enter your name, email, and a strong password.
2. Click **Create account**.

You're now logged in as `SUPER_ADMIN`.

## 4. Create a content type

1. Go to **Content Types** → **New Content Type**.
2. Name: `Blog Post`, Slug: `blog-post`.
3. Add fields:
   - `title` — Short Text, required
   - `body` — Rich Text
   - `slug` — Short Text, required
4. Click **Save**.

## 5. Create an entry

1. Go to **Blog Post** in the sidebar.
2. Click **New Entry**.
3. Fill in title, body, and slug.
4. Click **Save Draft**, then **Publish**.

## 6. Fetch via the public Delivery API

Published content is served from the public `/api/v1/delivery/*` endpoints — no token needed:

```bash
curl "http://localhost:3000/api/v1/delivery/content/blog-post?locale=en"
```

```json
{
  "data": [
    {
      "id": "cuid...",
      "slug": "my-first-post",
      "publishedAt": "2026-01-02T00:00:00.000Z",
      "data": { "title": "My First Post", "body": "..." }
    }
  ],
  "meta": { "total": 1, "limit": 20, "cursor": null, "hasNextPage": false }
}
```

For server-side callers you can pass an optional `X-Kast-Key` delivery key to raise the rate limit and bypass CORS.

## Next steps

- [Create your first content type](/getting-started/first-content-type/) — field types, validation, and ordering
- [Connect a frontend](/getting-started/connecting-a-frontend/) — use the SDK in your Next.js app
- [MCP & AI Agents](/mcp/connecting-claude/) — let Claude manage your content

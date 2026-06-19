# Kast CMS — Blog Starter

A minimal, production-ready **Next.js 16 (App Router)** blog that reads published content from a [Kast CMS](https://kastcms.com) instance through its public **Delivery API**.

It ships with a home page, a paginated blog index, post detail pages, category pages, an RSS feed, and a sitemap — all styled with Tailwind CSS v4 and dark-mode ready.

## How it fetches content

The starter reads **only published** content from the public Delivery API (`/api/v1/delivery/*`) — no admin token required:

| Data           | Endpoint                                       |
| -------------- | ---------------------------------------------- |
| Post list      | `GET /api/v1/delivery/content/blog-post`       |
| Single post    | `GET /api/v1/delivery/content/blog-post/:slug` |
| Categories     | `GET /api/v1/delivery/content/blog-category`   |
| Sitemap (Kast) | `GET /api/v1/delivery/sitemap.xml`             |

Fetching is centralised in [`src/lib/kast.ts`](src/lib/kast.ts) (`deliveryFetch`) and [`src/lib/content.ts`](src/lib/content.ts). The `@kast-cms/sdk` client is also exported from `kast.ts` for any authenticated/admin needs, but the public pages do not require it.

> A `locale` query param is **required** by the Delivery content endpoints; it defaults to `KAST_LOCALE` (`en`).

## Quick start

```bash
# 1. Install (from the monorepo root)
pnpm install

# 2. Configure
cp .env.example .env.local   # set KAST_API_URL etc.

# 3. (Once) create the blog-post & blog-category content types in Kast
pnpm seed

# 4. Run
pnpm dev   # http://localhost:3002
```

Create and **publish** a few `Blog Post` entries in the Kast admin panel, then refresh.

## Environment variables

| Variable                       | Required | Default                 | Description                                                              |
| ------------------------------ | -------- | ----------------------- | ------------------------------------------------------------------------ |
| `KAST_API_URL`                 | yes      | `http://localhost:3000` | Bare origin of the Kast API (no `/api/v1` — it is appended for you).     |
| `KAST_API_KEY`                 | no       | —                       | Optional read-only delivery key (`X-Kast-Key`) for SSR rate limits/CORS. |
| `KAST_LOCALE`                  | no       | `en`                    | Locale requested from the Delivery API.                                  |
| `NEXT_PUBLIC_SITE_URL`         | no       | `http://localhost:3002` | Public URL of this site (used in canonical URLs, sitemap, feed).         |
| `NEXT_PUBLIC_SITE_NAME`        | no       | `My Blog`               | Site name shown in the nav and feed.                                     |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | no       | —                       | Site description used in the RSS feed.                                   |

## Content model

`pnpm seed` provisions two content types:

- **`blog-post`** — `title`, `slug`, `excerpt`, `body` (rich text), `coverImage`, `publishedAt`, `author`, `category` (a category slug), `tags`, `readTimeMinutes`.
- **`blog-category`** — `name`, `slug`, `description`.

The TypeScript shapes for these live in [`src/types/index.ts`](src/types/index.ts).

## Scripts

| Script           | Description                              |
| ---------------- | ---------------------------------------- |
| `pnpm dev`       | Start the dev server on port 3002.       |
| `pnpm build`     | Production build.                        |
| `pnpm start`     | Serve the production build on port 3002. |
| `pnpm lint`      | ESLint over `src`.                       |
| `pnpm typecheck` | `tsc --noEmit`.                          |
| `pnpm seed`      | Create the blog content types in Kast.   |

## Project structure

```
src/
├── app/
│   ├── page.tsx                  # Home (featured + latest)
│   ├── blog/page.tsx             # Paginated post index
│   ├── blog/[slug]/page.tsx      # Post detail (+ JSON-LD, OG metadata)
│   ├── categories/[slug]/page.tsx
│   ├── feed.xml/route.ts         # RSS feed
│   └── sitemap.ts                # Next.js sitemap
├── components/                   # Nav, footer, cards, rich text
├── lib/
│   ├── kast.ts                   # Delivery API client + SDK client
│   └── content.ts                # Typed content helpers
└── types/index.ts                # Content data shapes
```

See the full [Kast docs](https://kastcms.com/docs) and the [Delivery API reference](https://kastcms.com/docs/api-reference/delivery).

# Kast CMS — Docs Starter

A minimal, production-ready **Next.js 16 (App Router)** documentation site that reads published content from a [Kast CMS](https://kastcms.com) instance through its public **Delivery API**.

It renders a category-grouped sidebar, doc pages with an auto-generated table of contents, a changelog timeline, and a sitemap — styled with Tailwind CSS v4 and dark-mode ready.

## How it fetches content

The starter reads **only published** content from the public Delivery API (`/api/v1/delivery/*`) — no admin token required:

| Data              | Endpoint                                       |
| ----------------- | ---------------------------------------------- |
| All doc pages     | `GET /api/v1/delivery/content/doc-page`        |
| Single doc page   | `GET /api/v1/delivery/content/doc-page/:slug`  |
| Changelog entries | `GET /api/v1/delivery/content/changelog-entry` |
| Sitemap (Kast)    | `GET /api/v1/delivery/sitemap.xml`             |

Fetching is centralised in [`src/lib/kast.ts`](src/lib/kast.ts) (`deliveryFetch`) and [`src/lib/content.ts`](src/lib/content.ts). The sidebar is built from all `doc-page` entries grouped by `categorySlug` and sorted by `order`.

> A `locale` query param is **required** by the Delivery content endpoints; it defaults to `KAST_LOCALE` (`en`). Doc slugs are looked up directly via the Delivery slug endpoint and validated against the requested category.

## Quick start

```bash
# 1. Install (from the monorepo root)
pnpm install

# 2. Configure
cp .env.example .env.local   # set KAST_API_URL etc.

# 3. (Once) create the doc-page & changelog-entry content types in Kast
pnpm seed

# 4. Run
pnpm dev   # http://localhost:3003
```

Create and **publish** a few `Documentation Page` entries in the Kast admin panel; the home page redirects to the first doc in the sidebar.

## Environment variables

| Variable                       | Required | Default                 | Description                                                              |
| ------------------------------ | -------- | ----------------------- | ------------------------------------------------------------------------ |
| `KAST_API_URL`                 | yes      | `http://localhost:3000` | Bare origin of the Kast API (no `/api/v1` — it is appended for you).     |
| `KAST_API_KEY`                 | no       | —                       | Optional read-only delivery key (`X-Kast-Key`) for SSR rate limits/CORS. |
| `KAST_LOCALE`                  | no       | `en`                    | Locale requested from the Delivery API.                                  |
| `NEXT_PUBLIC_SITE_URL`         | no       | `http://localhost:3003` | Public URL of this site (used in canonical URLs and the sitemap).        |
| `NEXT_PUBLIC_SITE_NAME`        | no       | `My Docs`               | Site name shown in the nav.                                              |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | no       | —                       | Site description.                                                        |

## Content model

`pnpm seed` provisions two content types:

- **`doc-page`** — `title`, `slug`, `category` (display name), `categorySlug`, `excerpt`, `body` (rich text), `order` (sidebar position), `publishedAt`.
- **`changelog-entry`** — `version`, `releasedAt`, `type` (`major` \| `minor` \| `patch` \| `security`), `summary`, `body`.

The TypeScript shapes for these live in [`src/types/index.ts`](src/types/index.ts).

## Scripts

| Script           | Description                              |
| ---------------- | ---------------------------------------- |
| `pnpm dev`       | Start the dev server on port 3003.       |
| `pnpm build`     | Production build.                        |
| `pnpm start`     | Serve the production build on port 3003. |
| `pnpm lint`      | ESLint over `src`.                       |
| `pnpm typecheck` | `tsc --noEmit`.                          |
| `pnpm seed`      | Create the docs content types in Kast.   |

## Project structure

```
src/
├── app/
│   ├── page.tsx                       # Redirects to the first doc page
│   ├── docs/[category]/[slug]/page.tsx# Doc page (sidebar + TOC + OG metadata)
│   ├── changelog/page.tsx             # Changelog timeline
│   └── sitemap.ts                     # Next.js sitemap
├── components/                        # Sidebar, nav, TOC, rich text, changelog
├── lib/
│   ├── kast.ts                        # Delivery API client + SDK client
│   └── content.ts                     # Typed content helpers + TOC builder
└── types/index.ts                     # Content data shapes
```

See the full [Kast docs](https://docs.kast.dev) and the [Delivery API reference](https://docs.kast.dev/api-reference/delivery/).

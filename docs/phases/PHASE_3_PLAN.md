# Phase 3 — The Polish

### _CLI. Deploy. Docs. Security. OAuth. Dashboard. Public Beta._

> Branch: `phase-3-polish` · Duration: Month 4–6 · Status: Planning
> References: [KAST_VISION.md](../architecture/KAST_VISION.md) · [KAST_PRD.md](../architecture/KAST_PRD.md) · [KAST_API_SPEC.md](../architecture/KAST_API_SPEC.md) · [KAST_DATABASE_SCHEMA.md](../architecture/KAST_DATABASE_SCHEMA.md) · [KAST_SECURITY_MODEL.md](../architecture/KAST_SECURITY_MODEL.md) · [KAST_DEV_STANDARDS.md](../architecture/KAST_DEV_STANDARDS.md) · [PHASE_2_PLAN.md](./PHASE_2_PLAN.md)

---

## Table of Contents

1. [Goal & Scope](#1-goal--scope)
2. [Out of Scope (Defer to v2)](#2-out-of-scope-defer-to-v2)
3. [Deliverable Map](#3-deliverable-map)
4. [Workstreams](#4-workstreams)
   - [WS-19 `create-kast-app` CLI (PH3-01)](#ws-19-create-kast-app-cli-ph3-01)
   - [WS-20 Next.js Frontend Starter Templates (PH3-02)](#ws-20-nextjs-frontend-starter-templates-ph3-02)
   - [WS-21 First-Party Plugins (PH3-03)](#ws-21-first-party-plugins-ph3-03)
   - [WS-22 Global Settings UI (PH3-04)](#ws-22-global-settings-ui-ph3-04)
   - [WS-23 Audit Log UI (PH3-05)](#ws-23-audit-log-ui-ph3-05)
   - [WS-24 Security Hardening (PH3-06)](#ws-24-security-hardening-ph3-06)
   - [WS-25 One-Click Deploy (PH3-07)](#ws-25-one-click-deploy-ph3-07)
   - [WS-26 Documentation Site (PH3-08)](#ws-26-documentation-site-ph3-08)
   - [WS-27 OAuth — Google + GitHub (PH3-10)](#ws-27-oauth--google--github-ph3-10)
   - [WS-28 Admin Dashboard (PH3-11)](#ws-28-admin-dashboard-ph3-11)
   - [WS-29 Queue Monitoring UI — Bull Board (PH3-12)](#ws-29-queue-monitoring-ui--bull-board-ph3-12)
   - [WS-30 Public Beta Launch (PH3-09)](#ws-30-public-beta-launch-ph3-09)
   - [WS-31 `@kast/sdk` v0.3](#ws-31-kastsdk-v03)
5. [Sprint Breakdown (12 weeks)](#5-sprint-breakdown-12-weeks)
6. [Phase 3 Exit Criteria](#6-phase-3-exit-criteria)
7. [Cross-Cutting Requirements Compliance](#7-cross-cutting-requirements-compliance)
8. [Risks & Mitigations](#8-risks--mitigations)
9. [Definition of Done](#9-definition-of-done)
10. [Branching & PR Strategy](#10-branching--pr-strategy)

---

## 1. Goal & Scope

Phase 3 transforms a feature-complete CMS engine into a **production-ready, publicly launchable product**. The engine is done. Phase 3 makes it easy to install, easy to deploy, easy to learn, safe to run in production, and attractive to the open-source community.

Phase 2 delivered every CMS capability. Phase 3 delivers the wrapper that makes non-trivial adoption possible: the CLI that eliminates setup friction, the deploy buttons that get a working CMS to production in under 10 minutes, the documentation that eliminates confusion, the OAuth login that eliminates password management, the security audit that eliminates liability, and the GitHub launch moment that starts the community.

**Done means:**

- `npx create-kast-app my-site` completes in under 3 minutes and produces a running CMS with one `docker-compose up`.
- A Next.js frontend starter (blog template + docs template) can be deployed alongside Kast with zero configuration.
- Five first-party plugins ship: `@kast/plugin-meilisearch`, `@kast/plugin-stripe`, `@kast/plugin-resend`, `@kast/plugin-r2`, `@kast/plugin-sentry`.
- The Global Settings UI is complete — site name, logo, SMTP config, storage provider, CORS origins, robots.txt, and maintenance mode.
- The Audit Log UI is searchable, filterable, and exportable from the admin panel.
- The full OWASP-based security checklist (25 items) passes — penetration tested and documented.
- One-click deploy buttons for Railway, Render, and Vercel work end-to-end with correct environment variable prompts.
- A full documentation site is live at `docs.kast.dev` covering installation, all modules, the SDK, and the plugin API.
- OAuth login (Google + GitHub) works end-to-end — new users auto-registered, existing users auto-linked.
- The admin dashboard shows real CMS health: entry counts per type, recent activity feed, SEO score distribution, media usage, and queue health.
- Bull Board queue monitoring UI is accessible at `/admin/queues` for SUPER_ADMIN.
- The public GitHub repository is polished: README, CONTRIBUTING, CODE_OF_CONDUCT, issue templates, PR templates.
- `@kast/sdk` v0.3 ships with CLI helpers, OAuth flows, and updated types.
- CI extended to include the full security checklist, Lighthouse score check on the admin login page, and SDK e2e against each deploy target.

---

## 2. Out of Scope (Defer to v2)

The following are intentionally **not** built in Phase 3:

| Deferred to | Item                                                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| v2          | Commerce module (products, variants, orders, Stripe checkout)                                                                     |
| v2          | Page builder (block/section visual editor)                                                                                        |
| v2          | AI content drafting UI (generate field values using Claude API)                                                                   |
| v2          | AI image alt-text generation on upload (backend hook exists; UI deferred)                                                         |
| v2          | AI migration assistant (import from WordPress, Ghost via AI field mapping)                                                        |
| v2          | GraphQL API (schema deferred; REST remains primary)                                                                               |
| v2          | GraphQL subscriptions / real-time updates                                                                                         |
| v2          | Team collaboration (simultaneous editing indicators, entry locking, comments)                                                     |
| v2          | Visual content modeling (drag-and-drop schema builder)                                                                            |
| v2          | SQLite support for local dev without Docker                                                                                       |
| v2          | Plugin marketplace (community registry with search and verified badges)                                                           |
| v2          | Translation status UI (per-locale translation completion indicator)                                                               |
| v2          | Machine translation integration (DeepL / Google Translate via plugin)                                                             |
| v2          | Scheduling calendar UI (full calendar view for scheduled entries)                                                                 |
| v2          | Version diff UI (side-by-side field diff between versions)                                                                        |
| v2          | Multi-tenancy                                                                                                                     |
| v2          | Kast Cloud (managed hosting product)                                                                                              |
| v2          | Password reset email flow (queue is wired; full UI + email template ships here) — actually ships in Phase 3 WS-27 alongside OAuth |

---

## 3. Deliverable Map

| PRD ID | Deliverable                                      | Workstream | Sprint |
| ------ | ------------------------------------------------ | ---------- | ------ |
| PH3-01 | `npx create-kast-app` CLI                        | WS-19      | S1–S2  |
| PH3-02 | Next.js frontend starter (blog + docs templates) | WS-20      | S3–S4  |
| PH3-03 | First-party plugins (5 plugins)                  | WS-21      | S4–S6  |
| PH3-04 | Global Settings UI                               | WS-22      | S3     |
| PH3-05 | Audit Log UI                                     | WS-23      | S4     |
| PH3-06 | Security hardening + OWASP checklist             | WS-24      | S7–S8  |
| PH3-07 | One-click deploy (Railway + Render + Vercel)     | WS-25      | S5–S6  |
| PH3-08 | Documentation site                               | WS-26      | S6–S10 |
| PH3-09 | Public beta launch on GitHub                     | WS-30      | S12    |
| PH3-10 | OAuth (Google + GitHub) + password reset         | WS-27      | S2–S3  |
| PH3-11 | Admin dashboard                                  | WS-28      | S5     |
| PH3-12 | Queue monitoring UI (Bull Board)                 | WS-29      | S5     |
| —      | `@kast/sdk` v0.3                                 | WS-31      | S11    |

---

## 4. Workstreams

Each workstream lists: **objective**, **tech decisions**, **scope**, **out-of-scope-this-phase**, **acceptance**, and **tasks**.

---

### WS-19 `create-kast-app` CLI (PH3-01)

**Objective:** Deliver the "easy like WordPress" install experience — a single CLI command that scaffolds a complete, running Kast project in under 3 minutes.

**Tech decisions:**

- **`packages/create-kast-app/`** — new pnpm workspace package published to NPM as `create-kast-app` (supports `npx create-kast-app`).
- **`@clack/prompts`** — modern, beautiful interactive CLI prompts with spinners and progress. No `inquirer` (too heavy).
- **`execa`** — subprocess management for running `pnpm install` and `docker-compose up --wait`.
- **`handlebars`** — template engine for generating project files from scaffolding templates stored in `packages/create-kast-app/templates/`.
- **Node.js ≥ 20** — enforced with a hard check at startup.
- **No TypeScript compilation required** — the CLI ships as pre-compiled ESM JS via `tsup`.

**Scope:**

**Interactive prompt flow:**

```
$ npx create-kast-app

  ██╗  ██╗ █████╗ ███████╗████████╗
  ██║ ██╔╝██╔══██╗██╔════╝╚══██╔══╝
  █████╔╝ ███████║███████╗   ██║
  ██╔═██╗ ██╔══██║╚════██║   ██║
  ██║  ██╗██║  ██║███████║   ██║
  ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝
  Cast Your Content Everywhere — v1.0.0

◆ Project name: my-site
◆ API port: [3001]
◆ Enable multiple languages (i18n)? Yes
◆ Default language: English (en)
◆ Add more languages? Arabic (ar)
◆ Storage provider:
  ● Local filesystem (recommended for dev)
  ○ Cloudflare R2 (production-ready)
  ○ Amazon S3
  ○ MinIO (self-hosted S3)
◆ Install plugins now?
  ✓ @kast/plugin-meilisearch (full-text search)
  ✗ @kast/plugin-stripe (commerce)
  ✓ @kast/plugin-sentry (error tracking)
◆ Include frontend starter? Blog template

◇ Scaffolding project...
◇ Generating docker-compose.yml...
◇ Writing .env.example...
◇ Installing dependencies...

✓ Done! Project created in ./my-site

  cd my-site
  cp .env.example .env
  docker-compose up

  Admin:  http://localhost:3001/admin
  API:    http://localhost:3001/api/v1
  MCP:    http://localhost:3001/mcp

  Documentation: https://docs.kast.dev
```

**Generated project structure:**

```
my-site/
├── apps/
│   ├── api/               # NestJS API (full kast API)
│   └── admin/             # Next.js admin panel
│   └── web/               # (optional) Next.js frontend starter
├── packages/
│   └── sdk/               # @kast/sdk (pre-configured for this project)
├── plugins/               # First-party plugins selected at setup
├── docker-compose.yml     # postgres + redis + api + admin
├── .env.example           # all required variables with comments
├── .env                   # (gitignored) copy of .env.example
├── package.json           # root pnpm workspace
├── pnpm-workspace.yaml
└── README.md              # project-specific readme with next steps
```

**`--skip-interactive` flag:**

Generates project with all defaults: English only, local storage, no plugins, no frontend starter.

**Node.js version check:**

Runs before any prompt. If Node.js < 20, exits with:

```
✖ Kast requires Node.js >= 20. You have 18.x.
  Upgrade: https://nodejs.org/en/download/
```

**Port conflict detection:**

Before scaffolding, checks if the chosen API port is in use. If so: `◆ Port 3001 is in use. Try: [3002]`.

**Railway / Render / Vercel deploy files:**

Generated automatically based on deploy target selection:

- `railway.toml` — Railway config
- `render.yaml` — Render blueprint
- `vercel.json` — Vercel project config

**Out of scope this phase:**

- Plugin marketplace install (Phase 3 only installs the 5 first-party plugins).
- `--template` flag for custom project templates.
- Windows support beyond WSL2 (untested; documented known limitation).

**Acceptance:**

- `npx create-kast-app my-site` on macOS (M-series) and Linux (Ubuntu 22.04) completes in under 3 minutes on average broadband.
- `cd my-site && cp .env.example .env && docker-compose up` starts all services. Admin accessible at `localhost:3001/admin`. API returns `200` at `localhost:3001/api/v1/health`.
- Running with Node.js 18 exits with code 1 and the upgrade message.
- `--skip-interactive` generates a valid project with no prompts.
- Generated `.env.example` contains all required variables with comments. None are pre-populated with real secrets.
- Port conflict detected: alternative port suggested, project uses the alternative after user confirms.

**Tasks:**

1. `feat(cli): scaffold create-kast-app package with tsup build`
2. `feat(cli): interactive prompt flow with @clack/prompts`
3. `feat(cli): project template engine with handlebars`
4. `feat(cli): docker-compose.yml generator (postgres + redis + api + admin)`
5. `feat(cli): .env.example generator (all variables documented)`
6. `feat(cli): node.js version check + port conflict detection`
7. `feat(cli): --skip-interactive flag with defaults`
8. `feat(cli): railway + render + vercel deploy file generation`
9. `feat(cli): plugin installer (copies plugin package + env vars into project)`
10. `chore(npm): publish create-kast-app to npm registry`
11. `test(cli): e2e test — run cli, verify generated structure, docker-compose up`

---

### WS-20 Next.js Frontend Starter Templates (PH3-02)

**Objective:** Ship two ready-to-use frontend starter templates that connect to Kast out of the box — so developers can go from `npx create-kast-app` to a published website in under an hour.

**Tech decisions:**

- **Next.js 16.2.4** — App Router, TypeScript strict, Tailwind CSS v4.
- **`@kast/sdk`** — all content fetching goes through the SDK; no raw `fetch` in templates.
- Both templates built as standalone `apps/web/` workspace, included optionally by the CLI.
- Templates use the **Delivery API** (public `X-Kast-Key` authenticated endpoints), not the admin API.

**Scope:**

**Template 1: Blog starter** (`apps/web-blog/`)

Pages:

- `/` — homepage with latest posts grid (fetches `GET /delivery/blog-post?limit=6&status=PUBLISHED`)
- `/blog` — full post list with pagination and search
- `/blog/[slug]` — individual post page with rich text rendering, SEO meta, OG image, author
- `/categories/[slug]` — category filter page

Features:

- Full SEO support: `generateMetadata` using `SeoMeta` from Kast API
- Sitemap: `app/sitemap.ts` that fetches Kast sitemap entries
- RSS feed: `app/feed.xml/route.ts`
- `next/image` for all media (pulls from Kast media CDN URL)
- Reading time estimate from rich text word count
- Dark mode toggle (Tailwind dark class strategy)
- Navigation menu driven by `GET /delivery/menus/main-nav` from Kast
- Contact form powered by `POST /forms/:id/submit` from Kast

**Template 2: Docs starter** (`apps/web-docs/`)

Pages:

- `/docs` — documentation home with category grid
- `/docs/[category]/[slug]` — individual doc page with sidebar nav, prev/next
- `/docs/search` — client-side search powered by the Meilisearch plugin (or falls back to Kast content search)
- `/changelog` — changelog page driven by a `changelog` content type

Features:

- Sidebar navigation driven by `GET /delivery/menus/docs-sidebar` from Kast
- Code syntax highlighting (Shiki)
- Table of contents auto-generated from rich text headings
- "Edit this page" link (optional, configurable to a GitHub repo)
- Full SEO + sitemap

**Content types required:**

Each template ships with a Kast seed script (`scripts/seed-content-types.ts`) that creates the necessary content types via the SDK. Running the seed requires a valid `KAST_API_URL` and `KAST_ADMIN_TOKEN` in the environment.

**Out of scope this phase:**

- E-commerce template (v2 commerce module).
- Visual page builder template (v2).
- Authentication / gated content in templates (v2).

**Acceptance:**

- `pnpm --filter @kast/web-blog dev` boots and fetches content from a running Kast instance. The homepage renders at least one post card.
- `GET /blog/[slug]` for a published post renders correct SEO meta in `<head>` (verified via `curl -s | grep og:title`).
- Running the seed script against a fresh Kast install creates all required content types. The templates function without manual schema setup.
- Sitemap at `/sitemap.xml` contains the same entries as `GET /api/v1/seo/sitemap.xml` from Kast.
- Both templates score ≥ 90 on Lighthouse Performance and ≥ 95 on Lighthouse SEO in CI.

**Tasks:**

1. `feat(web): scaffold blog starter template (app router, tailwind, sdk)`
2. `feat(web): blog — homepage, list page, post page, category page`
3. `feat(web): blog — seo metadata, sitemap, rss feed`
4. `feat(web): blog — navigation menu + contact form integration`
5. `feat(web): scaffold docs starter template`
6. `feat(web): docs — category page, doc page, changelog page`
7. `feat(web): docs — sidebar nav, toc, search integration`
8. `feat(web): shared seed script for both templates`
9. `chore(ci): lighthouse ci check on both templates`

---

### WS-21 First-Party Plugins (PH3-03)

**Objective:** Ship 5 first-party plugins that demonstrate the plugin system's power and solve the most common production integration needs.

**Tech decisions:**

- Each plugin is a separate pnpm workspace package under `plugins/`.
- All plugins use the `@kast/plugin-sdk` `IKastPlugin` interface from Phase 2.
- Each plugin ships its own `README.md` and is published to NPM as `@kast/plugin-<name>`.
- Plugin configuration (API keys, secrets) stored via the `PluginConfig` model — encrypted at rest (AES-256-GCM, established in Phase 2 security model).

**Scope:**

---

#### Plugin 1: `@kast/plugin-meilisearch`

**What it does:** Full-text search via [Meilisearch](https://meilisearch.com). Indexes all published content entries. Provides a search endpoint via the Kast API and a search component for frontend templates.

**Hooks consumed:**

- `content.published` → index the entry in Meilisearch
- `content.updated` → re-index the entry
- `content.trashed` → delete from index

**Admin UI panel** (`/admin/plugins/meilisearch`):

- Index status: document count per content type, last sync timestamp
- Re-index all button (enqueues a BullMQ `kast.meilisearch` job)
- Search test input (live query against the Meilisearch index)

**New API endpoint added by plugin:**

- `GET /api/v1/search?q=:query&types[]=:type&locale=:locale` — proxies to Meilisearch, returns typed results with highlights

**Config required:**

```
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_MASTER_KEY=your-master-key
```

**Acceptance:**

- Publish a content entry; within 5 seconds it is searchable via `/api/v1/search?q=<title>`.
- Trash an entry; it disappears from search results within 5 seconds.
- Re-index all: all published entries appear in the Meilisearch dashboard.

---

#### Plugin 2: `@kast/plugin-stripe`

**What it does:** Commerce foundation — syncs content types (products, prices) with Stripe. Listens for Stripe webhook events and updates content entries accordingly.

**Hooks consumed:**

- `content.published` (on content types tagged as Stripe products) → sync to Stripe Products/Prices API

**New API endpoints added by plugin:**

- `POST /api/v1/stripe/webhook` — public Stripe webhook receiver (HMAC-verified with `STRIPE_WEBHOOK_SECRET`)
- `GET /api/v1/stripe/sync/:contentTypeId` — trigger manual sync (ADMIN+)

**Admin UI panel** (`/admin/plugins/stripe`):

- Stripe connection status (live vs. test mode badge)
- Content type → Stripe product mapping configuration
- Recent sync log

**Config required:**

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MODE=test
```

**Acceptance:**

- Publish a `product` content entry; a corresponding Stripe Product is created in the Stripe dashboard.
- Stripe sends `product.updated` webhook; the `product` entry in Kast is updated.
- `STRIPE_WEBHOOK_SECRET` mismatch returns 400 and logs a warning.

---

#### Plugin 3: `@kast/plugin-resend`

**What it does:** Replaces the built-in SMTP email processor with Resend's API. The `kast.email` BullMQ queue processor is swapped to use Resend.

**Overrides:**

- `EmailProcessor` in `kast.email` queue — when this plugin is enabled, the processor uses Resend SDK instead of Nodemailer.
- No hooks needed — integrates at the queue processor level.

**New API endpoints added by plugin:**

- `GET /api/v1/email/templates` — list email templates (Resend broadcast templates)
- `POST /api/v1/email/test` — send a test email (SUPER_ADMIN only)

**Admin UI panel** (`/admin/plugins/resend`):

- Resend connection status (API key valid badge)
- Sender domain verification status (fetched from Resend API)
- Test email form

**Config required:**

```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_FROM_NAME=My Site
```

**Acceptance:**

- Invite a user with plugin enabled: invite email arrives via Resend (verified in Resend dashboard logs).
- Invalid API key: plugin load logs a warning; falls back to SMTP processor transparently.

---

#### Plugin 4: `@kast/plugin-r2`

**What it does:** Replaces local filesystem media storage with Cloudflare R2 (S3-compatible). Media uploads are streamed directly to R2. Public media URLs point to the R2 bucket CDN URL.

**Overrides:**

- `StorageService` — swaps the `LOCAL` storage provider for `R2` using the `@aws-sdk/client-s3` with a custom endpoint.
- `MediaProcessor` in `kast.media` queue — thumbnail and WebP optimization outputs written to R2.

**Config required:**

```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=kast-media
R2_PUBLIC_URL=https://media.yourdomain.com
```

**Admin UI panel** (`/admin/plugins/r2`):

- R2 connection test button
- Bucket stats: object count, total size (fetched from R2 S3-compatible ListObjectsV2)
- Migrate local files to R2 button (SUPER_ADMIN — enqueues migration jobs)

**Acceptance:**

- Upload a JPEG with plugin enabled; file saved in R2 bucket (verified via Cloudflare dashboard); `MediaFile.url` points to `R2_PUBLIC_URL`.
- Thumbnail and WebP variants written to R2, not local filesystem.
- Disable plugin: storage reverts to local; existing R2-hosted files' URLs still work (not purged).

---

#### Plugin 5: `@kast/plugin-sentry`

**What it does:** Sends all unhandled NestJS exceptions (5xx errors) to Sentry for error tracking. Adds request context (user ID, endpoint, request ID) to every Sentry event.

**Overrides:**

- `GlobalExceptionFilter` — wraps the existing filter to also call `Sentry.captureException`.

**Config required:**

```
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
```

**Admin UI panel** (`/admin/plugins/sentry`):

- Sentry project URL link
- Recent errors (last 10, fetched from Sentry Issues API)
- Test error button (throws a controlled exception) — SUPER_ADMIN only

**Acceptance:**

- Force a 500 error (invalid content type delete); event appears in Sentry dashboard within 10 seconds.
- User ID and request path included in Sentry event context.
- `SENTRY_DSN` not set: plugin loads but logs a startup warning; no errors thrown.

---

**Shared plugin tasks:**

1. `feat(plugin): @kast/plugin-meilisearch — hooks, index, search endpoint, admin UI`
2. `feat(plugin): @kast/plugin-stripe — product sync, webhook receiver, admin UI`
3. `feat(plugin): @kast/plugin-resend — email processor override, admin UI`
4. `feat(plugin): @kast/plugin-r2 — storage service override, migration tool, admin UI`
5. `feat(plugin): @kast/plugin-sentry — exception filter wrapper, admin UI`
6. `chore(npm): publish all 5 plugins to npm registry`
7. `test(plugin): integration tests for each plugin against docker-compose stack`

---

### WS-22 Global Settings UI (PH3-04)

**Objective:** Give SUPER_ADMIN a single settings page to configure everything about the Kast installation — site identity, SMTP, storage, CORS, maintenance mode, and content defaults.

**Scope:**

**Settings API (new endpoints):**

- `GET    /api/v1/settings` — get all global settings (ADMIN+)
- `PATCH  /api/v1/settings` — update one or many settings (SUPER_ADMIN)
- `POST   /api/v1/settings/test-smtp` — send test email via current SMTP config (SUPER_ADMIN)
- `POST   /api/v1/settings/test-storage` — test storage provider connectivity (SUPER_ADMIN)

**`GlobalSetting` model keys (stored as key-value in DB):**

| Key                          | Type     | Description                                              |
| ---------------------------- | -------- | -------------------------------------------------------- |
| `site.name`                  | string   | CMS site name (shown in admin topbar + emails)           |
| `site.logo`                  | mediaRef | Site logo (media file ID)                                |
| `site.favicon`               | mediaRef | Favicon                                                  |
| `site.url`                   | string   | Public site URL (used in sitemap, canonical URLs)        |
| `site.defaultLocale`         | string   | Default locale code (e.g. `en`)                          |
| `site.maintenanceMode`       | boolean  | Shows maintenance page on all public endpoints           |
| `smtp.host`                  | string   | SMTP host                                                |
| `smtp.port`                  | number   | SMTP port (default 587)                                  |
| `smtp.user`                  | string   | SMTP username                                            |
| `smtp.password`              | secret   | SMTP password (encrypted at rest)                        |
| `smtp.from`                  | string   | Default from address                                     |
| `smtp.fromName`              | string   | Default from display name                                |
| `storage.provider`           | enum     | `LOCAL` / `S3` / `R2` / `MINIO`                          |
| `storage.maxFileSizeMb`      | number   | Max upload size in MB (default 50)                       |
| `storage.allowedMimeTypes`   | string[] | Allowed MIME types for upload                            |
| `cors.allowedOrigins`        | string[] | Origins allowed in CORS policy                           |
| `robots.txt`                 | string   | Raw robots.txt content (served at `/robots.txt`)         |
| `seo.defaultMetaTitle`       | string   | Default meta title suffix (appended to all page titles)  |
| `seo.defaultMetaDescription` | string   | Default meta description (fallback)                      |
| `content.defaultStatus`      | enum     | Default status on entry creation (`DRAFT` / `PUBLISHED`) |
| `content.versionRetention`   | number   | Max versions to keep per entry (0 = unlimited)           |
| `media.imageQuality`         | number   | WebP conversion quality 1–100 (default 85)               |
| `media.generateThumbnails`   | boolean  | Auto-generate thumbnails on upload (default true)        |

**Admin UI — Settings page** (`/admin/settings`):

Tabbed layout with sections:

- **General** — site name, logo, favicon, site URL, default locale, maintenance mode toggle
- **Email** — SMTP config form (host, port, user, password masked, from, fromName), test email button
- **Storage** — storage provider dropdown, file size limit, MIME type whitelist, test connection button
- **Security** — CORS allowed origins (tag input), API rate limits display (read-only, configured via env)
- **SEO** — default meta title suffix, default meta description, robots.txt textarea
- **Content** — default entry status, version retention count, media image quality, thumbnail toggle

Each tab saves independently. Unsaved changes show a "You have unsaved changes" banner.

**Maintenance mode:**

When `site.maintenanceMode = true`:

- All `GET /api/v1/delivery/*` endpoints return `503 { error: "MAINTENANCE_MODE", message: "Site is under maintenance" }`.
- Admin API endpoints are unaffected.
- A maintenance banner appears in the admin topbar: "⚠ Maintenance mode is active — public delivery is offline."

**Out of scope this phase:**

- White-label admin panel (custom domain, branding per-workspace — v2).
- Per-user notification preferences (v2).

**Acceptance:**

- Update `site.name` from settings UI; admin topbar reflects the new name within 1 second (no page reload needed — Next.js revalidates).
- Enable maintenance mode; `GET /api/v1/delivery/blog-post` returns 503; admin panel still works.
- SMTP test email: fill SMTP config, click "Send test email", receive email at the configured address.
- CORS allowed origins: add `https://my-frontend.com`; `OPTIONS` preflight from that origin returns `Access-Control-Allow-Origin: https://my-frontend.com`.
- Version retention: set to 5; save entry 7 times; only 5 most recent versions visible in version history panel.

**Tasks:**

1. `feat(api): GlobalSettings CRUD API (get all, patch, test-smtp, test-storage)`
2. `feat(api): maintenance mode middleware — 503 on delivery endpoints when enabled`
3. `feat(api): CORS allowed origins dynamically loaded from GlobalSettings`
4. `feat(api): version retention enforcement in ContentEntryVersion creation`
5. `feat(admin): settings page — general tab`
6. `feat(admin): settings page — email tab with test button`
7. `feat(admin): settings page — storage tab with test button`
8. `feat(admin): settings page — security tab (cors origins)`
9. `feat(admin): settings page — seo tab (meta defaults, robots.txt editor)`
10. `feat(admin): settings page — content tab (defaults, retention, media)`
11. `feat(admin): maintenance mode banner in admin topbar`

---

### WS-23 Audit Log UI (PH3-05)

**Objective:** Make the audit trail built in Phase 2 actionable — a searchable, filterable, exportable log in the admin panel so ADMIN+ users can investigate what happened, when, and by whom.

**Scope:**

**Audit API enhancements:**

- `GET /api/v1/audit` already exists. Add query params:
  - `?action=content.publish` — filter by action
  - `?resource=ContentEntry` — filter by resource
  - `?resourceId=<id>` — filter by a specific entity
  - `?userId=<id>` — filter by actor
  - `?agentTokenId=<id>` — filter by AI agent
  - `?from=ISO8601&to=ISO8601` — date range
  - `?isDryRun=true` — only dry-run MCP operations
  - Cursor-based pagination (default 50 per page)
- `GET /api/v1/audit/export?format=csv` — download full audit log as CSV (ADMIN+, max 10,000 rows per export)

**Admin UI — Audit Log page** (`/admin/audit`):

**Filter bar:**

- Action dropdown (grouped: `content.*`, `media.*`, `auth.*`, `schema.*`, `tokens.*`, `mcp.*`, etc.)
- Resource type dropdown
- Actor input (search by name or email)
- Date range picker
- "AI actions only" toggle (filters `agentTokenId IS NOT NULL`)
- "Dry-run only" toggle

**Audit event table:**

- Timestamp (relative + absolute on hover)
- Actor avatar + name (or agent name with robot icon for AI actions)
- Action badge (color-coded: green = create, blue = read/list, amber = update, red = delete/trash, purple = MCP)
- Resource type + resource title/ID (clickable — deep links to the resource if it still exists)
- IP address (truncated, expandable)
- Dry-run badge (shown when `isDryRun: true`)
- Expand row → shows `before` / `after` JSON diff (redacted fields shown as `***`)

**Export:**

- "Export CSV" button — downloads up to 10,000 rows of the current filter as CSV.
- Columns: timestamp, actorName, actorEmail, agentName, action, resource, resourceId, ipAddress, isDryRun.

**Retention display:**

A banner at the top: "Audit logs are retained indefinitely. [KAST_SECURITY_MODEL.md §13](#)." Immutability is not configurable from the UI.

**Out of scope this phase:**

- Real-time audit log stream (WebSocket — v2).
- Audit log retention policies (v2 enterprise feature).
- Automated anomaly detection (v2).

**Acceptance:**

- Publish a content entry; within 1 second the audit log page shows a `content.publish` event for that entry.
- Filter by actor: enter "Oday"; only rows for that user appear.
- Filter by "AI actions only": only rows with `agentTokenId` shown.
- Expand a `content.update` row: `before` and `after` JSON rendered side-by-side; `passwordHash` fields redacted.
- Export CSV with 200 rows; CSV downloads with correct headers and all 200 rows.

**Tasks:**

1. `feat(api): audit log filter query params (action, resource, userId, agentTokenId, dates, isDryRun)`
2. `feat(api): audit log CSV export endpoint`
3. `feat(admin): audit log page with filter bar`
4. `feat(admin): audit event table with expand/diff view`
5. `feat(admin): csv export button`
6. `feat(admin): deep link from audit row to resource (content entry, user, media file)`

---

### WS-24 Security Hardening (PH3-06)

**Objective:** Verify and close every item on the OWASP Top 10 checklist and the KAST_SECURITY_MODEL.md 25-item checklist before public launch. This workstream is the security gate that separates "works" from "safe to run in production".

**Scope:**

**Security checklist items (from KAST_SECURITY_MODEL.md §15):**

Every checkbox must be verified with a test, a manual check, or a documented decision. Items include:

**Authentication:**

- JWT secret ≥ 32 chars validated on startup ✓ (Phase 1/2)
- JWT refresh secret separate from access secret ✓ (Phase 1/2)
- Refresh tokens stored as SHA-256 hashes ✓ (Phase 1/2)
- Token rotation on every refresh ✓ (Phase 1/2)
- Access token lifetime 15 minutes ✓ (Phase 1/2)
- OAuth flows use CSRF state parameter (WS-27)
- **NEW — Password reset flow end-to-end test** (email delivered, token expires, reuse rejected)

**Authorization:**

- Every protected endpoint has `@RequirePermission` decorator — automated scan via custom ESLint rule
- `RbacGuard` applied globally — audit routes that use `@Public()` decorator (document each one)
- SUPER_ADMIN accounts unmodifiable by ADMIN — integration test
- Privilege escalation test: EDITOR cannot create ADMIN-level tokens — integration test
- Agent token scopes enforced on every MCP tool call — integration test per tool

**HTTP Security:**

- All security headers present — verified via `securityheaders.com` report
- HSTS preload added for `kast.dev`
- CSP blocks inline scripts in production — test with `Content-Security-Policy-Report-Only` first
- CORS locked to specific origins (not `*`) in production — CI env test
- Rate limiting tested — 429 returned within CI integration test

**Data:**

- Passwords hashed with bcrypt cost factor 12 — code audit
- API/agent tokens shown once, stored as hash — code audit
- Plugin config values encrypted at rest — code audit
- No secrets in logs — automated grep test in CI: `grep -r "password\|secret\|token" logs/ | grep -v redacted`
- Database uses SSL in production — docker-compose.prod.yml uses `?sslmode=require`
- Audit log append-only — integration test: attempt DELETE on audit record, expect 405

**Input:**

- All DTOs use `whitelist: true` — ESLint rule + code audit
- Rich text sanitized with DOMPurify — unit test with XSS payload
- File uploads validated by MIME type AND magic bytes — unit test with MIME-spoofed file
- File size limits enforced — integration test: upload 51MB file, expect 413
- SQL injection impossible — Prisma parameterizes all queries (code audit, no raw SQL)

**Plugins:**

- Manifest permission verification at load time — integration test: plugin requesting `settings:write` rejected
- Plugin cannot access restricted models — unit test with mock prisma context

**OWASP Top 10 (2021) verification matrix:**

| OWASP ID | Vulnerability               | Kast Mitigation                                                                    | Verified By                         |
| -------- | --------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------- |
| A01      | Broken Access Control       | `RbacGuard` + `@RequirePermission` on every endpoint; SUPER_ADMIN-only routes      | Integration test suite              |
| A02      | Cryptographic Failures      | bcrypt(12) passwords; SHA-256 token hashes; AES-256-GCM plugin config encryption   | Code audit                          |
| A03      | Injection                   | Prisma parameterized queries; DOMPurify for rich text; `whitelist: true` DTOs      | Unit tests + code audit             |
| A04      | Insecure Design             | Soft delete; audit log; least-privilege RBAC; three-layer security model           | Architecture review                 |
| A05      | Security Misconfiguration   | Helmet + CSP; env validated at startup; no default secrets; `securityheaders.com`  | Automated CI check                  |
| A06      | Vulnerable Components       | `pnpm audit` in CI; Dependabot alerts enabled; no known-vulnerable dependencies    | CI: `pnpm audit --audit-level=high` |
| A07      | Authentication Failures     | Rate limiting (20/15min); JWT rotation; bcrypt; no username enumeration on reset   | Integration tests                   |
| A08      | Software/Data Integrity     | Plugin manifest hash verification; HMAC webhook signing; no `eval`                 | Code audit                          |
| A09      | Logging/Monitoring Failures | Audit interceptor on all mutations; Sentry plugin for 5xx; structured JSON logs    | Plugin integration test             |
| A10      | SSRF                        | Plugin network allowlist; no user-controlled URL fetch in core; URL validation DTO | Code audit + unit test              |

**New items this phase:**

- **Rate limit on `/api/v1/auth/login`**: already throttled; add a test that verifies 429 after 20 attempts.
- **Rate limit on `/api/v1/forms/:id/submit`**: 10/min per IP — integration test.
- **`pnpm audit` CI step**: add to CI pipeline; fail on `high` or `critical` vulnerabilities.
- **Dependabot**: enable for all packages in `.github/dependabot.yml`.
- **`Content-Security-Policy-Report-Only`**: enable in staging; analyze violations before switching to enforced.
- **Security documentation**: add `SECURITY.md` to the root with responsible disclosure policy and contact.
- **Bug bounty notice**: link in `SECURITY.md` to the GitHub Security Advisories page.

**Out of scope this phase:**

- Penetration test by a third-party firm (v2 enterprise feature).
- WAF (Web Application Firewall) configuration (deploy-target specific; documented in deploy guides).
- GDPR / data privacy compliance documentation (v2).

**Acceptance:**

- All 25 items in `KAST_SECURITY_MODEL.md §15` are checked with a linked test or documented evidence.
- All 10 OWASP Top 10 items have a documented mitigation and at least one automated test.
- `pnpm audit --audit-level=high` returns zero vulnerabilities.
- `securityheaders.com` report returns grade A or above for the production deploy.
- DOMPurify XSS test: submitting `<script>alert(1)</script>` in a rich text field stores `&lt;script&gt;alert(1)&lt;/script&gt;` — verified in DB.
- MIME magic byte test: uploading a `.php` file renamed to `.jpg` returns 400 with `File type mismatch`.

**Tasks:**

1. `security: add pnpm audit step to CI pipeline`
2. `security: add dependabot.yml for all workspaces`
3. `security: XSS unit test for DOMPurify rich text sanitization`
4. `security: MIME magic byte unit test for file upload`
5. `security: rate limit integration test (login + form submit)`
6. `security: RBAC integration test suite (privilege escalation + SUPER_ADMIN protection)`
7. `security: agent token scope enforcement integration test per MCP tool`
8. `security: SQL injection test (Prisma parameterization verification)`
9. `security: audit log immutability test (DELETE → 405)`
10. `security: CSP Report-Only header in staging; analyze and enforce`
11. `docs: add SECURITY.md with responsible disclosure policy`
12. `docs: add .github/dependabot.yml`
13. `chore: verify all 25 security checklist items and mark as done`

---

### WS-25 One-Click Deploy (PH3-07)

**Objective:** Let any developer get a production Kast instance running in under 10 minutes using a "Deploy to Railway" / "Deploy to Render" / "Deploy to Vercel" button.

**Tech decisions:**

- **Railway**: `railway.toml` + service definitions for API, admin, Postgres, Redis.
- **Render**: `render.yaml` blueprint with web services + managed Postgres + Redis.
- **Vercel**: `vercel.json` for `apps/admin` (Next.js) with environment variable prompts. Vercel cannot run the NestJS API — the API must be deployed separately (Railway or Render). Document this limitation clearly.
- **Docker Hub**: official `kast-cms/kast-api` and `kast-cms/kast-admin` images published to Docker Hub on every release tag.

**Scope:**

**Railway deploy:**

`railway.toml`:

```toml
[build]
  builder = "nixpacks"

[[services]]
  name = "kast-api"
  source = "apps/api"
  start = "node dist/main"
  envVars = [
    { name = "DATABASE_URL", linkedVar = "PGURL" },
    { name = "REDIS_URL", linkedVar = "REDISURL" }
  ]

[[services]]
  name = "kast-admin"
  source = "apps/admin"
  start = "node .next/standalone/server.js"

[[databases]]
  name = "postgres"

[[databases]]
  name = "redis"
```

**Render deploy:**

`render.yaml` blueprint with:

- `kast-api` web service (Docker or Nixpacks, `apps/api`)
- `kast-admin` web service (static site, `apps/admin` Next.js export)
- Managed PostgreSQL (free tier initially)
- Managed Redis (free tier initially)

**Vercel deploy:**

`vercel.json` for `apps/admin` only:

```json
{
  "buildCommand": "pnpm --filter @kast/admin build",
  "outputDirectory": "apps/admin/.next",
  "framework": "nextjs",
  "env": {
    "NEXT_PUBLIC_API_URL": "@kast-api-url",
    "AUTH_SECRET": "@auth-secret"
  }
}
```

**Docker Hub images:**

GitHub Actions workflow `publish-docker.yml`:

- Triggered on release tag `v*`
- Builds and pushes `kast-cms/kast-api:<version>` and `kast-cms/kast-admin:<version>` to Docker Hub
- Also tags `latest`

**README deploy buttons:**

```markdown
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/kast)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/kast-cms/kast)
[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/kast-cms/kast)
```

**CI/CD deploy verification:**

A CI job runs weekly (`cron: '0 0 * * 0'`) that:

1. Spins up the Railway deploy template
2. Waits for `GET /api/v1/health` to return 200
3. Runs a smoke test (login → create content type → create entry)
4. Tears down the deploy

**Out of scope this phase:**

- Fly.io deploy target (document as community-maintained).
- AWS ECS/EKS deploy guide (v2 enterprise).
- Kubernetes Helm chart (v2 enterprise).

**Acceptance:**

- Clicking the Railway deploy button from the README creates a working Kast instance with `DATABASE_URL` and `REDIS_URL` auto-configured. First-run setup wizard accessible.
- Docker Hub images `kast-cms/kast-api:1.0.0` and `kast-cms/kast-admin:1.0.0` exist and are pullable.
- Weekly CI smoke test passes against the Railway deploy.
- All three deploy buttons visible on the GitHub README.

**Tasks:**

1. `chore(deploy): add railway.toml with service definitions`
2. `chore(deploy): add render.yaml blueprint`
3. `chore(deploy): add vercel.json for apps/admin`
4. `chore(deploy): github actions publish-docker.yml workflow`
5. `chore(deploy): docker hub organization and repository setup`
6. `docs(deploy): Railway deploy guide (docs site)`
7. `docs(deploy): Render deploy guide (docs site)`
8. `docs(deploy): Vercel + Railway combined guide (admin on Vercel, API on Railway)`
9. `docs(deploy): Docker Compose production guide`
10. `chore(ci): weekly deploy smoke test workflow`

---

### WS-26 Documentation Site (PH3-08)

**Objective:** Ship a full documentation site at `docs.kast.dev` that lets any developer get started, understand every module, use the SDK, and build plugins — without asking a question.

**Tech decisions:**

- **[Starlight](https://starlight.astro.build/)** (by Astro) — best-in-class docs framework. Markdown + MDX, full-text search (Pagefind), dark mode, i18n, and a clean sidebar. No custom framework.
- **New `apps/docs/` workspace** — Astro + Starlight. Deployed to Vercel (or Cloudflare Pages).
- **`@kast/sdk` code examples** — all code examples in docs are real, typed, and tested in the SDK e2e suite.
- **OpenAPI spec embed** — the API reference section embeds the Swagger UI from the live API's `/api/docs` endpoint.

**Documentation structure:**

```
Getting Started
  ├── Installation (create-kast-app)
  ├── Docker Compose quickstart
  ├── First content type
  ├── First content entry
  └── Connecting a frontend

Concepts
  ├── Content modeling
  ├── Status lifecycle (draft / publish / schedule)
  ├── Localization & RTL
  ├── Media management
  ├── SEO module
  ├── Versioning & revert
  └── Trash & recovery

Admin Panel
  ├── Overview
  ├── Content Types
  ├── Content Editor
  ├── Media Library
  ├── Users & Roles
  ├── SEO Manager
  ├── Webhooks
  ├── Forms
  ├── Menus
  ├── Audit Log
  ├── Global Settings
  └── Queue Monitor

API Reference
  ├── Authentication
  ├── Content Types
  ├── Content Entries (+ delivery API)
  ├── Media
  ├── SEO
  ├── Locales
  ├── Users & Roles
  ├── Webhooks
  ├── Forms
  ├── Menus
  ├── MCP Server (15 tools)
  ├── Agent Tokens
  ├── Trash
  ├── Audit Log
  ├── Settings
  └── Health

SDK (@kast/sdk)
  ├── Installation
  ├── Authentication
  ├── Content types
  ├── Content entries
  ├── Media
  ├── SEO
  ├── Users & Roles
  ├── Webhooks
  ├── Forms
  ├── Menus
  ├── Versions
  ├── Trash
  └── Full API reference

Plugin Development
  ├── What is a plugin?
  ├── Plugin manifest
  ├── Hooks reference
  ├── Building your first plugin
  ├── Admin UI panels
  ├── Plugin config (encrypted)
  ├── Publishing to NPM
  └── First-party plugins (Meilisearch, Stripe, Resend, R2, Sentry)

MCP & AI Agents
  ├── Connecting Claude.ai to Kast
  ├── Agent tokens
  ├── All 15 MCP tools reference
  ├── Dry-run mode
  └── AgentSession audit log

Deploy
  ├── Railway (one-click)
  ├── Render (one-click)
  ├── Vercel + Railway
  ├── Docker Compose (production)
  └── Environment variables reference

Security
  ├── RBAC roles & permissions
  ├── Token types
  ├── Security checklist
  └── Responsible disclosure
```

**Search:**

Pagefind (Starlight default) — full-text search built into the static site. No server required.

**Versioning:**

Docs ship with version selector: `v1.0 (latest)` only at Phase 3. Version dropdown added when v2 ships.

**Out of scope this phase:**

- Video tutorials.
- Interactive playground (v2).
- Community-contributed docs.

**Acceptance:**

- `docs.kast.dev` is publicly accessible with zero auth.
- Every SDK method has a code example with correct TypeScript types.
- API Reference section renders the OpenAPI/Swagger spec from `GET /api/v1/docs-json`.
- Pagefind search returns correct results for queries like "how to publish", "create content type", "agent token".
- Docs site scores ≥ 95 Lighthouse Performance and ≥ 95 Lighthouse Accessibility in CI.
- All 15 MCP tools are individually documented with input schema and example output.
- "Edit this page on GitHub" link on every page works correctly.

**Tasks:**

1. `feat(docs): scaffold Starlight docs app under apps/docs`
2. `feat(docs): Getting Started section (install, quickstart, first content, frontend connect)`
3. `feat(docs): Concepts section (all 7 pages)`
4. `feat(docs): Admin Panel section (all 12 pages)`
5. `feat(docs): API Reference section (all 16 modules)`
6. `feat(docs): SDK reference (all method groups with code examples)`
7. `feat(docs): Plugin Development section (all 8 pages)`
8. `feat(docs): MCP & AI Agents section (all 5 pages)`
9. `feat(docs): Deploy section (all 5 guides + env vars reference)`
10. `feat(docs): Security section`
11. `chore(docs): deploy to Vercel (or Cloudflare Pages) with custom domain docs.kast.dev`
12. `chore(ci): lighthouse check on docs site`

---

### WS-27 OAuth — Google + GitHub (PH3-10)

**Objective:** Let users sign in with Google or GitHub instead of a password — and complete the password reset email flow that was wired in Phase 2 but not surfaced in the UI.

**Tech decisions:**

- **Passport.js** — `passport-google-oauth20` and `passport-github2` strategies. Same Passport setup as Phase 1/2 JWT strategy.
- **CSRF state parameter** — generated as a random 32-byte hex, stored in a 5-minute `HttpOnly` cookie, verified on callback. Required by KAST_SECURITY_MODEL.md.
- **No new session type** — OAuth and password login both converge on the same JWT + refresh token pair. No distinction at the session layer.
- **Account linking** — if the OAuth email matches an existing `User.email`, the `OAuthAccount` is linked to the existing user without creating a new account.

**Scope:**

**New API endpoints:**

- `GET  /api/v1/auth/oauth/google` — redirect to Google OAuth consent screen
- `GET  /api/v1/auth/oauth/google/callback` — Google OAuth callback, find/create user, issue JWT pair, redirect to admin
- `GET  /api/v1/auth/oauth/github` — redirect to GitHub OAuth consent screen
- `GET  /api/v1/auth/oauth/github/callback` — GitHub OAuth callback, find/create user, issue JWT pair, redirect to admin
- `POST /api/v1/auth/forgot-password` — request password reset (sends email via BullMQ `kast.email`, always returns 200)
- `POST /api/v1/auth/reset-password` — submit new password with reset token (token 1-hour TTL, single-use)

**`OAuthAccount` model** (already in Phase 1 Prisma schema):

```
provider         String   -- "google" | "github"
providerAccountId String  -- provider's user ID
accessToken      String   -- encrypted at rest (AES-256-GCM)
userId           String   -- FK to User
```

**`PasswordResetToken` model** (new — add to Prisma schema):

```
id        String    @id @default(cuid())
userId    String    @unique
hash      String    -- SHA-256 of the plain token
expiresAt DateTime
usedAt    DateTime?
createdAt DateTime  @default(now())
```

**OAuth flow security:**

```
1. GET /auth/oauth/google
   → generate state token (32 bytes), store in HttpOnly cookie (5 min TTL)
   → redirect to Google with state param

2. Google redirects to /auth/oauth/google/callback?code=...&state=...
   → verify state matches cookie value (CSRF protection)
   → exchange code for access token
   → fetch Google user profile (email, name, avatar)
   → find User by email OR create new User
   → create/update OAuthAccount (access token encrypted)
   → issue Kast JWT pair
   → redirect to /admin/dashboard
```

**Password reset flow:**

```
1. POST /auth/forgot-password { email }
   → always returns 200 (never reveals email existence)
   → if user found: generate reset token (32 bytes), hash it, store PasswordResetToken (1h TTL)
   → enqueue kast.email job with reset link: ${SITE_URL}/admin/reset-password?token=<plain>

2. POST /auth/reset-password { token, newPassword }
   → hash token, find PasswordResetToken where hash matches AND expiresAt > NOW() AND usedAt IS NULL
   → if not found: 400 "Invalid or expired reset link"
   → bcrypt.hash new password, update User.passwordHash
   → mark token as used (usedAt = now())
   → revoke all refresh tokens for user (force re-login everywhere)
   → return 200 "Password updated"
```

**Email template for password reset:**

HTML email template with:

- Kast logo (from `site.logo` GlobalSetting)
- `site.name` in subject: `Reset your password — {site.name}`
- One big CTA button: "Reset Password" → `${SITE_URL}/admin/reset-password?token=...`
- "If you didn't request this, you can ignore this email."
- Token valid for 1 hour, noted in the email.

**Admin UI updates:**

- Login screen already has "Continue with Google" and "Continue with GitHub" buttons (Phase 2 WS-1 stub). Wire them to the OAuth endpoints.
- "Forgot password?" link (below password input) → navigates to `/admin/forgot-password`.
- `/admin/forgot-password` page — email input, submit button, success state.
- `/admin/reset-password?token=...` page — new password input, confirm password input, strength meter, submit. On invalid/expired token: error state with link to request a new one.
- User profile page (`/admin/profile`): show connected OAuth accounts (Google / GitHub badges), with "Connect" / "Disconnect" buttons.

**Out of scope this phase:**

- SAML / LDAP (v2 enterprise).
- Apple OAuth (v2).
- Magic link login (v2).

**Acceptance:**

- Click "Continue with Google" on the login screen; complete OAuth consent; redirected to admin dashboard logged in as the Google account's user.
- If the Google account's email matches an existing Kast user, no duplicate user is created; the `OAuthAccount` is linked to the existing user.
- Request password reset for a valid email: email arrives within 30 seconds; link in email works; password updated; old session invalidated.
- Request password reset for a non-existent email: same 200 response, no email sent, no timing difference visible.
- Use a reset token twice: second use returns 400 "Invalid or expired reset link".
- Use a reset token after 1 hour: 400 "Invalid or expired reset link".

**Tasks:**

1. `feat(api): passport google oauth strategy + callback`
2. `feat(api): passport github oauth strategy + callback`
3. `feat(api): CSRF state parameter in oauth flows`
4. `feat(api): OAuthAccount create/link on oauth callback`
5. `feat(api): forgot-password + reset-password endpoints`
6. `feat(api): PasswordResetToken model + migration`
7. `feat(api): password reset email template + kast.email job`
8. `feat(admin): wire google + github login buttons to oauth endpoints`
9. `feat(admin): forgot password page + reset password page`
10. `feat(admin): user profile page — connected oauth accounts`

---

### WS-28 Admin Dashboard (PH3-11)

**Objective:** Give every user a meaningful home screen when they log in — not a blank page. The dashboard surfaces real CMS health at a glance.

**Scope:**

**New API endpoints:**

- `GET /api/v1/dashboard/stats` — aggregate stats (EDITOR+):
  - `{ contentEntries: { total, byStatus: { draft, published, scheduled, archived }, byType: [{ typeSlug, count }] } }`
  - `{ media: { total, totalSizeMb, byMimeGroup: { image, video, document, other } } }`
  - `{ seo: { averageScore, scoreDistribution: { below50, between50and74, above74 } } }`
  - `{ forms: { total, submissionsToday, submissionsThisWeek } }`
  - `{ users: { total, active, invited } }`
- `GET /api/v1/dashboard/activity` — recent audit log events (last 20, no filters) (EDITOR+)
- `GET /api/v1/dashboard/queue-health` — BullMQ queue summary (ADMIN+):
  - Per queue: waiting, active, completed, failed, delayed counts

**Admin UI — Dashboard page** (`/admin`):

**Top row (stat cards):**

- Published entries count (with trend vs. last 7 days: +12)
- Draft entries count
- Media files count (total size)
- Active users count

**Middle row:**

- **Entry status chart**: donut chart — Draft / Published / Scheduled / Archived proportions (per most-used content type, with a type selector dropdown)
- **SEO score distribution**: bar chart — entries below 50, 50–74, 75+ — motivates editors to fix poor scores
- **Recent activity feed**: last 15 audit events with actor avatar, action summary, relative time. Clicking an event deep-links to the resource.

**Bottom row (ADMIN+ only):**

- **Queue health table**: per queue — waiting / active / failed counts. Red row if `failed > 0`. Clicking a queue row navigates to `/admin/queues` (Bull Board).
- **Upcoming scheduled entries**: list of the next 5 entries with scheduled publish times.

**Quick action bar** (pinned under topbar):

- "New Entry" (opens content type selector)
- "Upload Media"
- "View Audit Log"
- "System Settings" (ADMIN+)

**Empty state:**

New installs (zero entries, zero media) show an onboarding checklist:

- ✓ Create your admin account
- ○ Create your first content type → [link]
- ○ Create your first entry → [link]
- ○ Upload a media file → [link]
- ○ Connect a frontend → [link to docs]

**Out of scope this phase:**

- Real-time live updates (WebSocket dashboard — v2).
- Custom dashboard widgets / drag-to-reorder (v2).
- Analytics integrations (Google Analytics, Plausible — v2 plugin).

**Acceptance:**

- New install: onboarding checklist visible with correct completion state.
- After creating 5 entries and publishing 3: stat cards show correct counts; donut chart reflects 2 Draft / 3 Published.
- Queue health table shows green for all queues when no failures. Force a webhook failure: the `kast.webhook` row turns red with `failed: 1`.
- Recent activity feed updates within 5 seconds of a content publish event (no manual refresh required — polling interval 10s or SSE).

**Tasks:**

1. `feat(api): dashboard stats aggregation endpoint`
2. `feat(api): dashboard activity endpoint (recent audit events)`
3. `feat(api): dashboard queue health endpoint`
4. `feat(admin): dashboard page — stat cards + charts`
5. `feat(admin): recent activity feed with polling (10s interval)`
6. `feat(admin): queue health table with link to bull board`
7. `feat(admin): upcoming scheduled entries list`
8. `feat(admin): onboarding checklist for new installs`
9. `feat(admin): quick action bar`
10. `chore(admin): redirect /admin root to /admin/dashboard`

---

### WS-29 Queue Monitoring UI — Bull Board (PH3-12)

**Objective:** Give SUPER_ADMIN real-time visibility into BullMQ job queues — waiting, active, failed, dead-letter — without needing Redis CLI access.

**Tech decisions:**

- **`@bull-board/nestjs`** — official NestJS adapter for Bull Board. Mounts a Bull Board UI at `/admin/queues` as a NestJS middleware.
- **SUPER_ADMIN only** — the Bull Board middleware is wrapped in the NestJS auth guard. Only JWT tokens with `SUPER_ADMIN` role can access it.
- **No separate package** — added directly to `apps/api` as a new route, exposed through the `apps/admin` Next.js reverse proxy at `/admin/queues`.

**Scope:**

**API changes:**

- Add `@bull-board/nestjs` and `@bull-board/ui` to `apps/api/package.json`.
- Register `BullBoardModule.forRoot({ route: '/admin/queues' })` in `AppModule`.
- Register all 6 queues with `BullBoardModule.forFeature(...)`.
- Add auth middleware to the `/admin/queues` path that validates the JWT and checks `SUPER_ADMIN` role.

**Queue visibility per queue:**

- `kast.webhook` — delivery jobs, retry counts, dead-letter view
- `kast.media` — optimize and thumbnail jobs, per-file progress
- `kast.seo` — validate jobs per entry
- `kast.publish` — delayed (scheduled) jobs with countdown timers
- `kast.trash` — daily cleanup cron jobs, items deleted counts
- `kast.email` — send jobs with email recipient (sanitized) and subject

**Admin UI integration:**

- Add "Queue Monitor" link to the admin sidebar (SUPER_ADMIN only) pointing to `/admin/queues`.
- The Bull Board UI renders inside the admin layout via an `<iframe>` or by proxying the Bull Board static assets through the Next.js app.

**Actions available in Bull Board:**

- Retry failed jobs
- Remove completed jobs
- Pause/resume a queue (SUPER_ADMIN only — logged to audit)
- Clean dead-letter queue

**Out of scope this phase:**

- Custom queue metrics charts (v2 — real-time charts via WebSocket).
- Per-job notification alerts (v2 — Slack/email on job failure).

**Acceptance:**

- Navigate to `/admin/queues` as SUPER_ADMIN: Bull Board renders with all 6 queues visible.
- Navigate to `/admin/queues` as EDITOR: 403 returned.
- Force a webhook failure: `kast.webhook` queue shows the failed job. Retry from Bull Board: job re-runs, delivery log updated.
- Pause the `kast.media` queue from Bull Board: new uploads are queued but not processed. Resume: queued jobs begin processing.

**Tasks:**

1. `feat(api): install @bull-board/nestjs and register with BullBoardModule`
2. `feat(api): SUPER_ADMIN auth middleware on /admin/queues route`
3. `feat(api): register all 6 queues with Bull Board`
4. `feat(admin): queue monitor link in sidebar (SUPER_ADMIN only)`
5. `feat(admin): queue monitor page (proxy or iframe for Bull Board UI)`

---

### WS-30 Public Beta Launch (PH3-09)

**Objective:** Ship the public GitHub repository in a state that makes developers want to star, fork, and contribute — then announce the beta.

**Scope:**

**Repository polish:**

**`README.md` (root):**

```markdown
# Kast CMS

Cast Your Content Everywhere.

Open-source. AI-native. Developer-first. Easy for everyone.

[Deploy to Railway] [Deploy to Render] [Deploy to Vercel]
[Docs] [Discord] [Twitter/X]

## Why Kast?

...

## Features

...

## Quickstart

npx create-kast-app my-site

## Documentation

docs.kast.dev

## Contributing

See CONTRIBUTING.md
```

**`.github/` files:**

- `CONTRIBUTING.md` — existing file enhanced with:
  - Development environment setup (full docker-compose dev workflow)
  - How to run tests
  - How to write a plugin
  - Code style (ESLint + Prettier config)
  - Conventional commit convention
  - PR process (branch → PR → review → squash merge)
  - Releasing (versioning policy)

- `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1

- `SECURITY.md` — responsible disclosure policy (from WS-24):
  - Where to report security issues (GitHub Security Advisories)
  - Expected response time (48h)
  - Out-of-scope: DoS, rate limit bypass without OWASP severity

- `.github/ISSUE_TEMPLATE/bug_report.md` — structured bug report:
  - Environment (OS, Node.js version, Kast version, deploy target)
  - Steps to reproduce
  - Expected vs. actual behavior
  - Logs / screenshots

- `.github/ISSUE_TEMPLATE/feature_request.md` — feature request template

- `.github/PULL_REQUEST_TEMPLATE.md` — PR checklist:
  - [ ] Conventional commit subject
  - [ ] `pnpm typecheck` passes
  - [ ] `pnpm lint` passes
  - [ ] Tests added/updated
  - [ ] SDK types updated (if new endpoints)
  - [ ] Docs updated (if new feature)

**Release automation:**

GitHub Actions `release.yml` workflow:

- Triggered on `git tag v*`
- Runs full CI suite
- Publishes `create-kast-app` and all `@kast/*` packages to NPM
- Builds and pushes Docker Hub images
- Creates a GitHub Release with auto-generated changelog (from conventional commits)
- Deploys docs site

**Community:**

- GitHub Discussions enabled (categories: Q&A, Ideas, Show & Tell)
- Discord server link in README (community Discord)
- Twitter/X announcement thread drafted
- Dev.to article drafted: "We built an AI-native CMS from scratch in 3 months. Here's everything we did."

**Acceptance:**

- `github.com/kast-cms/kast` README renders correctly with deploy buttons and feature highlights.
- All 5 community files present: README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, ISSUE_TEMPLATE.
- `git tag v1.0.0 && git push --tags` triggers the release workflow; NPM packages and Docker images published; GitHub Release created.
- Docs site live at `docs.kast.dev`.
- GitHub Discussions enabled.

**Tasks:**

1. `docs(readme): complete root README with features, quickstart, deploy buttons`
2. `docs(contributing): enhance CONTRIBUTING.md with full dev workflow`
3. `docs(community): add CODE_OF_CONDUCT.md (Contributor Covenant 2.1)`
4. `docs(security): add SECURITY.md (from WS-24)`
5. `chore(github): add issue templates (bug + feature request)`
6. `chore(github): add PR template with checklist`
7. `chore(ci): add release.yml workflow (tag → npm publish + docker push + gh release)`
8. `chore(ci): add changelog generation from conventional commits`
9. `chore(community): enable GitHub Discussions`

---

### WS-31 `@kast/sdk` v0.3

**Objective:** Update the TypeScript SDK to cover all Phase 3 additions — OAuth helpers, CLI utilities, dashboard stats, Global Settings, Audit Log export — and ship as `v0.3.0`.

**Scope:**

New `KastClient` method groups and updates:

| Group              | Methods                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `client.settings`  | `getAll`, `update`, `testSmtp`, `testStorage`                                                                      |
| `client.audit`     | `list` (with all filters), `export` (returns `Blob`)                                                               |
| `client.dashboard` | `getStats`, `getActivity`, `getQueueHealth`                                                                        |
| `client.auth`      | `loginWithPassword` (existing), `getOAuthUrl` (returns Google/GitHub OAuth URL), `forgotPassword`, `resetPassword` |
| `client.content`   | Updated types — `isAiGenerated` field, `scheduledAt` filter on list                                                |
| `client.plugins`   | `getConfig`, `updateConfig` (new — plugin config management via SDK)                                               |

**SDK versioning:**

- Bump `packages/sdk/package.json` to `0.3.0`.
- All new types exported from `packages/sdk/src/index.ts`.

**Acceptance:**

- A Node.js script using `@kast/sdk` v0.3 can: get dashboard stats, update global settings, list audit log with date filter, export audit log as CSV (Buffer), get OAuth URLs for Google and GitHub — all with zero `any`.
- `pnpm --filter @kast/sdk typecheck` passes.

**Tasks:**

1. `feat(sdk): settings resource (getAll, update, testSmtp, testStorage)`
2. `feat(sdk): audit resource (list with filters, export as Blob)`
3. `feat(sdk): dashboard resource (stats, activity, queueHealth)`
4. `feat(sdk): auth — getOAuthUrl, forgotPassword, resetPassword`
5. `feat(sdk): plugins — getConfig, updateConfig`
6. `feat(sdk): bump version to 0.3.0, update all exports`
7. `test(sdk): phase 3 e2e test suite`

---

## 5. Sprint Breakdown (12 weeks)

Each sprint = 1 week. Multiple workstreams run in parallel where dependencies allow.

| Sprint  | Theme                                  | Workstreams in Flight                | Exit Demo                                                                                                        |
| ------- | -------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **S1**  | CLI Foundation                         | WS-19 (start)                        | `npx create-kast-app my-test` generates a valid project structure; `docker-compose up` starts services           |
| **S2**  | CLI Complete + OAuth                   | WS-19 (finish), WS-27                | CLI end-to-end on macOS + Linux; Google OAuth login works in dev; GitHub OAuth works in dev                      |
| **S3**  | Frontend + Settings + Password Reset   | WS-20 (start), WS-22, WS-27          | Blog starter renders content from Kast; Settings page saves site name; forgot-password email arrives             |
| **S4**  | Frontend Complete + Audit UI + Plugins | WS-20 (finish), WS-23, WS-21 (start) | Docs starter functional; Audit log page filters working; Meilisearch plugin indexes on publish                   |
| **S5**  | Deploy + Dashboard + Queue Monitor     | WS-25, WS-28, WS-29                  | Railway deploy button works; Dashboard stat cards render real data; Bull Board accessible as SUPER_ADMIN         |
| **S6**  | Plugins + Deploy + Docs Start          | WS-21 (finish), WS-25, WS-26 (start) | All 5 plugins pass integration tests; Render deploy works; Docs site skeleton live at docs.kast.dev              |
| **S7**  | Security Hardening (part 1)            | WS-24 (start)                        | `pnpm audit` zero high/critical; XSS + MIME tests pass; RBAC escalation integration tests pass                   |
| **S8**  | Security Hardening (part 2)            | WS-24 (finish)                       | All 25 security checklist items verified; OWASP Top 10 matrix complete; `securityheaders.com` grade A            |
| **S9**  | Docs Content                           | WS-26 (continue)                     | Getting Started, Concepts, and Admin Panel sections complete; all 15 MCP tools documented                        |
| **S10** | Docs Complete                          | WS-26 (finish)                       | Full docs site live; SDK reference complete; Plugin Development guide live; Deploy guides live                   |
| **S11** | SDK v0.3 + Polish                      | WS-31                                | `@kast/sdk` v0.3 e2e suite passes; `pnpm turbo typecheck` green on all packages                                  |
| **S12** | Public Beta Launch                     | WS-30                                | README polished; release workflow triggers NPM + Docker publish; GitHub Discussions enabled; announcement posted |

---

## 6. Phase 3 Exit Criteria

Lifted directly from [KAST_PRD.md §4](../architecture/KAST_PRD.md), expanded to be testable.

| ID    | Criterion                                                                          | Verified By                                                                             |
| ----- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| EX-1  | `npx create-kast-app` completes in under 3 minutes on average broadband            | Timed run on macOS M-series and Ubuntu 22.04 in CI                                      |
| EX-2  | `docker-compose up` on a generated project starts all services in under 30 seconds | Health check: `GET /api/v1/health` returns 200 within 30s of `docker-compose up`        |
| EX-3  | Railway one-click deploy produces a working Kast instance                          | CI smoke test: deploy → `GET /health` → login → create entry                            |
| EX-4  | All 107 API endpoints documented in the docs site API Reference                    | Manual audit of `GET /api/v1/docs-json` OpenAPI spec vs. docs pages                     |
| EX-5  | Security audit passes all 25 checklist items                                       | `KAST_SECURITY_MODEL.md §15` — all items checked with test or documented evidence       |
| EX-6  | OWASP Top 10 mitigation matrix complete                                            | WS-24 matrix table — all 10 items have a documented mitigation and automated test       |
| EX-7  | `pnpm audit --audit-level=high` returns zero vulnerabilities                       | CI: `pnpm audit` step passes                                                            |
| EX-8  | Docs site live at `docs.kast.dev` with all sections complete                       | Manual review of all 7 top-level sections; zero 404 links                               |
| EX-9  | Google and GitHub OAuth login works end-to-end                                     | Integration test: OAuth flow → JWT issued → admin accessible                            |
| EX-10 | Password reset flow works end-to-end                                               | Integration test: request reset → email arrives → click link → new password works       |
| EX-11 | Admin dashboard renders real data for a populated Kast instance                    | e2e: create 5 entries, 3 media files, run test → dashboard counts match                 |
| EX-12 | `@kast/sdk` v0.3 e2e suite passes against Docker Compose stack                     | CI: sdk e2e job passes with v0.3 methods                                                |
| EX-13 | GitHub Release `v1.0.0` created with NPM packages + Docker images published        | `npm info create-kast-app` returns `1.0.0`; `docker pull kast-cms/kast-api:1.0.0` works |
| EX-14 | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` all green on main      | CI: full suite passes on the merge commit closing Phase 3                               |

---

## 7. Cross-Cutting Requirements Compliance

| CR    | Requirement                | Phase 3 Implementation                                                                                                                               |
| ----- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| CR-01 | TypeScript strict          | `apps/docs` (Astro/Starlight) uses TypeScript strict in Astro components; `create-kast-app` compiled with strict tsup config                         |
| CR-02 | Audit every mutation       | WS-22 Global Settings mutations audited; WS-27 OAuth login/logout, password reset audited; WS-28 queue pause/resume audited                          |
| CR-03 | Three-layer security       | OAuth callbacks protected by CSRF state; Bull Board behind SUPER_ADMIN JWT guard; deploy targets enforce HTTPS (HSTS from WS-24)                     |
| CR-04 | BullMQ for background work | Password reset email goes through `kast.email` queue; Meilisearch re-index goes through `kast.meilisearch` queue (plugin-owned)                      |
| CR-05 | Consistent error shape     | OAuth callback errors return standard envelope; CLI errors use `@clack/prompts` styled output but log structured JSON to `stderr`                    |
| CR-06 | Soft delete with trash     | No new models in Phase 3 that skip the trash pattern; Global Settings uses upsert (not delete); `PasswordResetToken` hard-deleted after use          |
| CR-07 | i18n ready                 | CLI prompts are English only Phase 3; `create-kast-app` scaffolded project inherits Phase 2 i18n; docs site English only Phase 3                     |
| CR-08 | RTL support                | Docs site (Starlight) supports RTL natively; no new admin UI components added in Phase 3 that violate logical CSS                                    |
| CR-09 | Zero `console.log`         | ESLint rule applied to `create-kast-app` CLI (uses NestJS Logger pattern for structured output to stderr); Starlight docs site no backend logs       |
| CR-10 | Env validated on startup   | `create-kast-app` validates generated `.env` at scaffold time; Global Settings encryption key `PLUGIN_CONFIG_ENCRYPTION_KEY` validated in env schema |

---

## 8. Risks & Mitigations

| Risk                                                                   | Likelihood | Impact | Mitigation                                                                                                                        |
| ---------------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| CLI platform quirks (Windows path separators, pnpm not in PATH)        | High       | Med    | Document WSL2 as supported Windows path; test on Ubuntu CI; add Windows-specific notes to README                                  |
| Railway / Render API changes break one-click deploy                    | Med        | Med    | Pin deploy config file schemas; include integration smoke test in CI that re-runs weekly                                          |
| Docs site scope creep (writing good docs is slow)                      | High       | Med    | Timebox each section to 2 days; ship minimal but correct docs before comprehensive docs; "Edit on GitHub" lowers contribution bar |
| OAuth provider credential leakage during testing                       | Low        | High   | Use separate OAuth apps for dev/staging/prod; never commit OAuth secrets; validate via env schema at startup                      |
| Bull Board exposes queue internals to XSS if job payload contains HTML | Med        | Med    | Bull Board renders job payloads as raw JSON; CSP blocks inline scripts; audit payloads for XSS in WS-24                           |
| Meilisearch plugin indexing lag causes stale search results            | Med        | Low    | Index update is async via BullMQ; document 5-second eventual consistency; add "Re-index all" button in admin UI                   |
| `pnpm audit` fails on launch day due to newly disclosed CVE            | Low        | High   | Run `pnpm audit` in CI 24h before launch; have a patch-and-release plan ready                                                     |
| Docs site SEO — Starlight default config might not hit Lighthouse 95   | Low        | Low    | Run Lighthouse in CI from S6; address issues before S10 docs completion                                                           |
| Release automation (NPM publish + Docker push) fails on v1.0.0 tag     | Med        | High   | Test release workflow on `v0.9.0-rc.1` tag before the real `v1.0.0`; verify NPM token and Docker Hub credentials in CI secrets    |

---

## 9. Definition of Done

A workstream is **done** only when every item below is true:

- [ ] All deliverables implemented per the scope defined in this plan.
- [ ] Permissions enforced per [KAST_SECURITY_MODEL.md](../architecture/KAST_SECURITY_MODEL.md).
- [ ] Unit tests for every new service method with branching logic.
- [ ] Integration/e2e tests covering happy path + at least 2 error paths per new endpoint.
- [ ] No `any`, no `@ts-ignore`, no `console.log` in production code.
- [ ] No `ml-`, `mr-`, `pl-`, `pr-` Tailwind classes in `apps/admin` — only logical property equivalents.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` all pass locally.
- [ ] Audit interceptor verified to fire for new mutations.
- [ ] SDK types updated for any new endpoints.
- [ ] Documentation page written for the feature (or linked to existing docs).
- [ ] PR reviewed with conventional commit on merge.
- [ ] Security checklist items relevant to the workstream verified.

---

## 10. Branching & PR Strategy

- **Phase branch:** `phase-3-polish` (this branch). All Phase 3 work merges into here.
- **Feature branches:** `feat/<workstream>-<short-desc>` (e.g. `feat/ws19-create-kast-app-cli`) cut from `phase-3-polish`.
- **PRs:** target `phase-3-polish`. Squash-merge with conventional commit subject.
- **Workstream ordering:**
  - WS-19 (CLI) and WS-27 (OAuth) can begin in parallel from day one.
  - WS-21 (plugins) depends on WS-22 (settings) being merged first (plugin config uses GlobalSettings).
  - WS-28 (dashboard) depends on WS-22 (settings) for the maintenance mode banner.
  - WS-26 (docs) runs continuously from S6 to S10 — docs PRs are always welcome.
  - WS-31 (SDK) opens after all API-adding workstreams (WS-22, WS-23, WS-27, WS-28) are merged.
  - WS-30 (launch) is last — opens when all other exit criteria are met.
- **Phase exit:** when all 14 exit criteria pass, open a single PR `phase-3-polish` → `develop`, then `develop` → `main`. Tag `v1.0.0` on `main`.
- **Hotfixes:** branch from `main`, cherry-pick to `develop` and `phase-3-polish`.
- **Release tags:** semantic versioning — `v1.0.0` on Phase 3 completion. Pre-release: `v1.0.0-beta.1` at S12 start.

---

_Plan owner: @kast-cms maintainers · Last updated: 2026-04-27_

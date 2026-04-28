# Phase 2 — The Differentiators

### _Admin panel. SEO. MCP. i18n. Webhooks. Plugins. Everything that makes Kast unique._

> Branch: `phase-2-engine` · Duration: Month 2–4 · Status: Planning
> References: [KAST_VISION.md](../architecture/KAST_VISION.md) · [KAST_PRD.md](../architecture/KAST_PRD.md) · [KAST_API_SPEC.md](../architecture/KAST_API_SPEC.md) · [KAST_DATABASE_SCHEMA.md](../architecture/KAST_DATABASE_SCHEMA.md) · [KAST_SECURITY_MODEL.md](../architecture/KAST_SECURITY_MODEL.md) · [KAST_DEV_STANDARDS.md](../architecture/KAST_DEV_STANDARDS.md) · [PHASE_1_PLAN.md](./PHASE_1_PLAN.md)

---

## Table of Contents

1. [Goal & Scope](#1-goal--scope)
2. [Out of Scope (Defer to Phase 3)](#2-out-of-scope-defer-to-phase-3)
3. [Deliverable Map](#3-deliverable-map)
4. [Workstreams](#4-workstreams)
   - [WS-1 `apps/admin` Next.js Foundation (PH2-01 base)](#ws-1-appsadmin-nextjs-foundation-ph2-01-base)
   - [WS-2 Admin — Content Modeling UI (PH2-01)](#ws-2-admin--content-modeling-ui-ph2-01)
   - [WS-3 Admin — Editorial UI (PH2-02)](#ws-3-admin--editorial-ui-ph2-02)
   - [WS-4 Admin — Media Library UI](#ws-4-admin--media-library-ui)
   - [WS-5 Admin — Users, Roles & API Tokens UI](#ws-5-admin--users-roles--api-tokens-ui)
   - [WS-6 SEO Module — API + Admin UI (PH2-03)](#ws-6-seo-module--api--admin-ui-ph2-03)
   - [WS-7 MCP Server — 15 Tools (PH2-04)](#ws-7-mcp-server--15-tools-ph2-04)
   - [WS-8 i18n Module + RTL Admin UI (PH2-05)](#ws-8-i18n-module--rtl-admin-ui-ph2-05)
   - [WS-9 Draft / Publish / Schedule Workflow (PH2-06)](#ws-9-draft--publish--schedule-workflow-ph2-06)
   - [WS-10 Version History + Revert (PH2-07)](#ws-10-version-history--revert-ph2-07)
   - [WS-11 BullMQ — All 6 Queues Operational (PH2-08)](#ws-11-bullmq--all-6-queues-operational-ph2-08)
   - [WS-12 Webhook System (PH2-09)](#ws-12-webhook-system-ph2-09)
   - [WS-13 Plugin System v1 (PH2-10)](#ws-13-plugin-system-v1-ph2-10)
   - [WS-14 Agent Tokens + MCP RBAC (PH2-11)](#ws-14-agent-tokens--mcp-rbac-ph2-11)
   - [WS-15 Forms Module (PH2-12)](#ws-15-forms-module-ph2-12)
   - [WS-16 Menus Module (PH2-13)](#ws-16-menus-module-ph2-13)
   - [WS-17 Trash + 30-day Recovery (PH2-14)](#ws-17-trash--30-day-recovery-ph2-14)
   - [WS-18 `@kast-cms/sdk` v0.2](#ws-18-kastsdk-v02)
5. [Sprint Breakdown (10 weeks)](#5-sprint-breakdown-10-weeks)
6. [Phase 2 Exit Criteria](#6-phase-2-exit-criteria)
7. [Cross-Cutting Requirements Compliance](#7-cross-cutting-requirements-compliance)
8. [Risks & Mitigations](#8-risks--mitigations)
9. [Definition of Done](#9-definition-of-done)
10. [Branching & PR Strategy](#10-branching--pr-strategy)

---

## 1. Goal & Scope

Phase 2 ships everything that makes Kast **distinctly Kast** — the admin panel, the SEO engine, the MCP server, i18n with full RTL support, the draft/publish workflow, version history, all six BullMQ queues, webhooks, plugins, agent tokens, forms, menus, and trash recovery.

Phase 1 delivered the API spine. Phase 2 makes it usable by editors, AI agents, and plugin developers. At the end of Phase 2, a non-technical editor can log in, model a content type, write content in multiple languages, see a live SEO score before publishing, and have an AI agent manage their CMS via Claude.

**Done means:**

- A `Next.js 16.2.4` admin panel (`apps/admin`) that covers the full content authoring workflow, media management, user/role management, SEO, webhooks, forms, menus, trash, and settings.
- A fully operational MCP server at `/mcp` with 15 documented tools, scoped agent tokens, and session audit logging.
- A live SEO score pipeline: entry saved → BullMQ `kast.seo` queue → score written back → displayed in editor before publish.
- All 6 BullMQ queues (`kast.webhook`, `kast.media`, `kast.seo`, `kast.publish`, `kast.trash`, `kast.email`) running real processors with retry + dead-letter.
- RTL admin UI rendering correctly for Arabic and all RTL locales. CSS logical properties throughout.
- `@kast-cms/sdk` v0.2 with typed access to every Phase 2 endpoint.
- CI extended with `apps/admin` typecheck, lint, and e2e (Playwright smoke tests against the full stack).

---

## 2. Out of Scope (Defer to Phase 3)

The following are intentionally **not** built in Phase 2:

| Deferred to | Item                                                               |
| ----------- | ------------------------------------------------------------------ |
| Phase 3     | `npx create-kast-app` CLI                                          |
| Phase 3     | Next.js frontend starter (blog + docs templates)                   |
| Phase 3     | First-party plugins: Stripe, Meilisearch, Resend, R2, Sentry       |
| Phase 3     | Global Settings full UI (basic settings land in Phase 2 scaffold)  |
| Phase 3     | Audit log full UI (audit entries are queryable via API in Phase 2) |
| Phase 3     | Full security hardening audit                                      |
| Phase 3     | One-click deploy: Railway, Render, Vercel                          |
| Phase 3     | OAuth — Google / GitHub login                                      |
| Phase 3     | Password reset email flow (email queue wired in Phase 2)           |
| Phase 3     | GraphQL API (schema deferred; REST remains primary)                |
| Phase 3     | Admin dashboard analytics / metrics                                |
| Phase 3     | Bull Board queue monitoring UI                                     |
| Phase 3     | Plugin marketplace                                                 |
| Phase 3     | Full public documentation site                                     |

---

## 3. Deliverable Map

| PRD ID | Deliverable                            | Workstream | Sprint |
| ------ | -------------------------------------- | ---------- | ------ |
| PH2-01 | Next.js admin — content modeling UI    | WS-1, WS-2 | S1–S2  |
| PH2-02 | Next.js admin — editorial UI           | WS-3       | S3     |
| —      | Admin — media library UI               | WS-4       | S4     |
| —      | Admin — users, roles & API tokens UI   | WS-5       | S4     |
| PH2-03 | SEO module + live validation panel     | WS-6       | S5     |
| PH2-04 | MCP server — 15 tools                  | WS-7       | S6     |
| PH2-05 | i18n module + RTL admin UI             | WS-8       | S7     |
| PH2-06 | Draft / Publish / Schedule workflow    | WS-9       | S5     |
| PH2-07 | Version history + revert               | WS-10      | S8     |
| PH2-08 | BullMQ queues — all 6 operational      | WS-11      | S7     |
| PH2-09 | Webhook system (outbound, HMAC, retry) | WS-12      | S8     |
| PH2-10 | Plugin system v1                       | WS-13      | S10    |
| PH2-11 | Agent tokens + MCP RBAC                | WS-14      | S6     |
| PH2-12 | Forms module                           | WS-15      | S9     |
| PH2-13 | Menus module                           | WS-16      | S9     |
| PH2-14 | Trash + 30-day recovery                | WS-17      | S9     |
| —      | `@kast-cms/sdk` v0.2                   | WS-18      | S10    |

---

## 4. Workstreams

Each workstream lists: **objective**, **tech decisions**, **scope**, **out-of-scope-this-phase**, **acceptance**, and **tasks**.

---

### WS-1 `apps/admin` Next.js Foundation (PH2-01 base)

**Objective:** Bootstrap `apps/admin` as a Next.js 16.2.4 App Router application with RTL-ready design system, authenticated layout, and protected routing — the shell that all admin UI workstreams build inside.

**Tech decisions:**

- **Next.js 16.2.4** — App Router, TypeScript strict, `"use client"` minimal, Server Components by default.
- **Tailwind CSS v4** — CSS logical properties throughout for RTL compatibility (`ms-`, `me-`, `ps-`, `pe-` instead of `ml-`, `mr-`, `pl-`, `pr-`).
- **shadcn/ui** — component library built on Radix UI. All components customized to use logical properties. Dark mode ready.
- **next-intl** — i18n strings for the admin UI itself. Ships in English; Arabic added in WS-8.
- **@kast-cms/sdk** — all API calls go through the typed SDK, never raw `fetch` in components.
- **Auth:** `next-auth` is **not** used. Instead, access token stored in memory (React context) and refresh token in an `HttpOnly` cookie managed by the Next.js API route `/api/auth/refresh`. Session state is minimal — just the decoded JWT payload.

**Scope:**

- `apps/admin/` workspace in pnpm. `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json` (extends `../../tsconfig.base.json` per dev standards, with `moduleResolution: "Bundler"` and `jsx: "preserve"`).
- Root layout: sidebar navigation, topbar (breadcrumb + user menu + locale switcher), content area.
- Sidebar links (initially as stubs): Content Types, Content, Media, Users, Roles, SEO, Webhooks, Forms, Menus, Trash, Settings.
- Auth flow: `/admin/login` page, session context provider, `middleware.ts` protecting all `/admin/*` routes, token refresh interceptor in SDK wrapper.
- First-run setup wizard: `/admin/setup` (rendered when zero users in DB, as per AC-AUT-001 in PRD §7).
- 404 and error boundary pages.
- Storybook (optional — Phase 3 polish): not required here.

**Out of scope this phase:**

- Dashboard home with analytics (Phase 3).
- Dark mode toggle (foundations in place; active toggle Phase 3).
- Per-module deep UI (covered in WS-2 through WS-17).

**Acceptance:**

- `pnpm --filter @kast-cms/admin dev` boots at `localhost:3001/admin` with valid env.
- `/admin/login` authenticates against the Phase 1 API and redirects to `/admin/content-types`.
- `/admin/setup` renders when no users exist; creates SUPER_ADMIN and redirects.
- Navigating without a session redirects to `/admin/login`.
- All CSS uses logical properties (no `ml-`, `mr-`, `pl-`, `pr-` anywhere in codebase — enforced by ESLint plugin `eslint-plugin-logical-css`).
- `pnpm --filter @kast-cms/admin typecheck` and `pnpm --filter @kast-cms/admin lint` pass.

**Tasks:**

1. `feat(admin): scaffold Next.js 16.2.4 app under apps/admin`
2. `feat(admin): add tsconfig, tailwind, and next.config per dev standards`
3. `feat(admin): add shadcn/ui with logical-css tailwind preset`
4. `feat(admin): add authenticated layout (sidebar, topbar, session context)`
5. `feat(admin): add auth session management (memory token + httponly cookie refresh)`
6. `feat(admin): add next-intl setup for admin ui strings (english base)`
7. `feat(admin): add middleware.ts protecting all /admin routes`
8. `feat(admin): add login page + first-run setup wizard`
9. `feat(admin): add 404, error boundary, loading skeleton pages`
10. `chore(ci): extend ci workflow with admin typecheck and lint`

---

### WS-2 Admin — Content Modeling UI (PH2-01)

**Objective:** Give developers and admins a visual interface to create, configure, and manage content types and their fields — the schema builder.

**Scope:**

- **Content types list page** (`/admin/content-types`): table of all types with name, API ID, entry count, field count, last updated. Create button.
- **Create/edit content type** (`/admin/content-types/new`, `/admin/content-types/[id]`): name (auto-generates API ID, editable), description, icon picker, enable localization toggle, enable draft/publish toggle.
- **Field builder panel**: drag-and-drop reorderable list of fields. Add / edit / delete each field.
- **Field types supported:**
  - `text` — single-line, optional min/max length, optional regex pattern
  - `rich-text` — Tiptap editor output (ProseMirror JSON)
  - `number` — integer or float, optional min/max
  - `boolean` — toggle
  - `date` — date-only, datetime, or time
  - `media` — single file or multiple files, MIME type filter
  - `relation` — one-to-one, one-to-many, or many-to-many to another ContentType
  - `json` — freeform JSON block
  - `email` — email string with format validation
  - `url` — URL string with format validation
  - `enum` — comma-separated list of allowed values
  - `uid` — auto-generated unique string based on a target field (slug pattern)
- **Field configuration sheet**: drawer that opens on field click/add with all field options, required toggle, unique toggle, hidden toggle, localized toggle (only available when content type has i18n enabled).
- **Delete content type**: confirmation dialog warning about data loss, requires typing the API ID to confirm.
- **API ID immutability**: once published entries exist, API ID is locked (UI shows lock icon + tooltip).

**Out of scope this phase:**

- Custom field types from plugins (scaffold for extension points yes; custom fields rendered from a plugin manifest — Phase 3 plugin polish).
- Field-level permissions UI (API supports it; UI deferred to Phase 3).

**Acceptance:**

- Create a `blog-post` type with fields: `title (text, required)`, `body (rich-text)`, `coverImage (media)`, `publishedAt (date)`, `slug (uid, from title)` via the UI.
- Field order changed by drag-and-drop persists after page refresh.
- Delete confirmation requires typing the API ID; wrong input keeps the button disabled.
- Localization toggle on the content type shows the "localized" checkbox on eligible field types.

**Tasks:**

1. `feat(admin): content types list page with create button`
2. `feat(admin): create/edit content type form (name, api-id, description, icon)`
3. `feat(admin): field builder with drag-and-drop reorder`
4. `feat(admin): field type: text, rich-text, number, boolean`
5. `feat(admin): field type: date, media, relation, json`
6. `feat(admin): field type: email, url, enum, uid`
7. `feat(admin): field configuration drawer (required, unique, hidden, localized)`
8. `feat(admin): delete content type dialog with api-id confirmation`
9. `feat(api): content-types PATCH endpoint for field reorder`

---

### WS-3 Admin — Editorial UI (PH2-02)

**Objective:** Give editors a clean interface to create, edit, draft, and publish content entries for any content type — the day-to-day CMS experience.

**Scope:**

- **Entry list page** (`/admin/content/[typeId]`): table of entries with columns: title-field value, status badge (DRAFT / PUBLISHED / ARCHIVED), locale, author, updated date. Search bar, filter by status/locale, sort by any column, cursor-based pagination.
- **Entry editor** (`/admin/content/[typeId]/new`, `/admin/content/[typeId]/[entryId]`): dynamic form that renders the correct input component for each field type defined in the content type. All field types from WS-2 rendered correctly.
- **Rich text editor**: Tiptap with toolbar (bold, italic, underline, heading 1-3, ordered/unordered list, blockquote, code, link, image from media picker). Output is ProseMirror JSON stored in `ContentEntryLocale.data`.
- **SEO panel** (collapsible sidebar panel): meta title, meta description character counters, OG image picker, canonical URL input. Live score badge (from WS-6). Appears only for content types that have the SEO feature enabled.
- **Locale switcher tab bar**: if the content type has i18n enabled, shows tabs per active locale. Switching tabs loads locale-specific field values.
- **Action bar**: Save Draft, Publish, Unpublish, Schedule (date/time picker). Status badge updates live after action.
- **Media picker dialog**: browse/search the media library, select file(s), insert into the field or rich text editor.
- **Bulk actions on entry list**: select multiple, then Trash / Publish / Unpublish.
- **Autosave**: draft autosaved every 30 seconds if the entry is in DRAFT state (debounced, no network flood).

**Out of scope this phase:**

- Version history panel (WS-10, S8).
- Comments / collaborative editing (no plans before Phase 3).
- Custom field type rendering from plugins (WS-13 adds the extension point).

**Acceptance:**

- Create a `blog-post` entry: fill title, write body in rich text, attach cover image from media picker, save as draft. Entry appears in list with DRAFT badge.
- Publish the draft: status changes to PUBLISHED in the list within 1 second.
- Switch locale tab: field values change to the locale-specific version; saving writes to the correct `ContentEntryLocale` row.
- Autosave fires after 30s of inactivity; a subtle "Saved" toast appears.
- Bulk trash: select 3 entries, click Trash, confirm. All 3 disappear from the list (soft-deleted).

**Tasks:**

1. `feat(admin): entry list page with search, filter, sort, pagination`
2. `feat(admin): entry editor — dynamic field renderer per content type`
3. `feat(admin): rich text editor (tiptap) with toolbar and media embed`
4. `feat(admin): media picker dialog`
5. `feat(admin): locale switcher tab bar in entry editor`
6. `feat(admin): action bar — save draft, publish, unpublish, schedule`
7. `feat(admin): seo panel in entry editor (stub — wired fully in WS-6)`
8. `feat(admin): bulk actions on entry list`
9. `feat(admin): autosave on draft entries (30s debounce)`

---

### WS-4 Admin — Media Library UI

**Objective:** A visual media manager for uploading, organizing, browsing, and selecting files.

**Scope:**

- **Media library page** (`/admin/media`): grid view (default) and list view toggle. Files sorted by `createdAt` desc. Pagination (infinite scroll in grid, cursor in list).
- **Upload zone**: drag-and-drop overlay on the whole page or a dedicated upload button. Multiple files at once. Progress bar per file. Validation (size limit from GlobalSettings, MIME type whitelist from GlobalSettings).
- **Folder sidebar**: hierarchical folder tree from `MediaFolder` model. Create folder, rename folder, move files into folder by drag-and-drop. Root shows all unorganized files.
- **File detail panel** (slide-in from right when clicking a file): preview (image/video/audio native preview, icon fallback), filename (inline editable), alt text input, file size, MIME type, dimensions (images), "Used in" list of content entries that reference this file, copy URL button, download button, move to folder, move to trash.
- **Search**: full-text search on filename and alt text.
- **Bulk select**: checkbox mode, bulk move to folder, bulk trash.

**Out of scope this phase:**

- Image editing / cropping (Phase 3).
- Video transcoding (Phase 3, likely a plugin).

**Acceptance:**

- Drag 5 images onto the media page; all upload with progress bars; appear in the grid immediately after upload.
- Create folder `blog-covers`; drag 3 uploaded images into it; folder sidebar shows count = 3.
- Click an image; detail panel shows alt text input; edit alt text, save; API call updates `MediaFile.altText`.
- Delete image from detail panel; image moves to trash (soft delete); disappears from grid.

**Tasks:**

1. `feat(admin): media library grid/list page with pagination`
2. `feat(admin): drag-and-drop upload zone with progress bars`
3. `feat(admin): folder sidebar with create, rename, drag-move`
4. `feat(admin): file detail panel (preview, alt text, used in, actions)`
5. `feat(admin): media search by filename/alt text`
6. `feat(admin): bulk select, move, and trash`

---

### WS-5 Admin — Users, Roles & API Tokens UI

**Objective:** Let admins manage who has access to the CMS, what roles they hold, and what API tokens exist.

**Scope:**

- **Users list page** (`/admin/users`): table with name, email, roles, status (active/invited/suspended), last login date. Search by name/email. Filter by role.
- **Invite user**: email input + role selector. Sends invite email via BullMQ `kast.email`. Invited user appears in list with "Invited" badge.
- **Edit user** (`/admin/users/[id]`): change display name, assign/remove roles, suspend/activate account. Cannot self-suspend.
- **Roles page** (`/admin/roles`): list of system roles (read-only) and custom roles (editable). SUPER_ADMIN only.
- **Create/edit custom role**: role name, description, and permission matrix (checkbox grid: resource × action — read / create / update / delete).
- **API Tokens page** (`/admin/api-tokens`): list of tokens (name, prefix, last used, scopes, expiry). Create token: name, optional expiry, scope selection. Token value shown once at creation in a modal. Revoke token.

**Out of scope this phase:**

- Agent token management UI (handled in WS-14, alongside the MCP module).
- OAuth provider management (Phase 3).

**Acceptance:**

- Invite `editor@example.com` with EDITOR role: invite appears in user list, invite email job enqueued in BullMQ `kast.email`.
- Create custom role `Content Reviewer` with read-only permissions on ContentEntry and ContentType: role appears in role selector when inviting users.
- Create API token `sdk-staging` with no expiry: token value shown once; only prefix visible in the list; copy button works.
- Revoke a token: gone from list; subsequent API calls with that token return 401.

**Tasks:**

1. `feat(admin): users list page with search and role filter`
2. `feat(admin): invite user flow with email enqueue`
3. `feat(admin): edit user page (name, roles, suspend)`
4. `feat(admin): roles page — system roles view, custom roles crud`
5. `feat(admin): custom role permission matrix`
6. `feat(admin): api tokens page — list, create (show once), revoke`
7. `feat(api): users invite endpoint + user management endpoints`
8. `feat(api): custom roles API (CRUD + permission assignment)`

---

### WS-6 SEO Module — API + Admin UI (PH2-03)

**Objective:** Build the SEO module that the PRD calls a core differentiator — meta, OG, structured data, sitemaps, redirects, and a live score pipeline.

**Scope:**

**API endpoints (per [KAST_API_SPEC.md §6](../architecture/KAST_API_SPEC.md)):**

- `GET    /api/v1/seo/meta/:entryId` — get SEO meta for an entry
- `PUT    /api/v1/seo/meta/:entryId` — upsert SEO meta
- `GET    /api/v1/seo/score/:entryId` — get latest SEO score (from `SeoScore` + `SeoIssue` models)
- `POST   /api/v1/seo/validate/:entryId` — trigger validation job (enqueues `kast.seo`)
- `GET    /api/v1/seo/sitemap.xml` — generate and serve the sitemap (public, CORS-exempt)
- `GET    /api/v1/robots.txt` — serve robots.txt (public, CORS-exempt, content from GlobalSettings)
- `GET    /api/v1/seo/redirects` — list redirect rules (paginated)
- `POST   /api/v1/seo/redirects` — create redirect rule
- `PATCH  /api/v1/seo/redirects/:id` — update redirect rule
- `DELETE /api/v1/seo/redirects/:id` — delete redirect rule

**SEO validation logic (BullMQ `kast.seo` processor):**

Checks performed per entry:

- Title present and length 30–60 chars
- Meta description present and length 50–160 chars
- OG image present
- Canonical URL set and valid
- No duplicate meta title across published entries of the same type
- Slug does not contain uppercase or special characters
- Rich text body word count ≥ 300 words
- At least one H2 heading in body
- No broken internal links (checked against known entry slugs)

Score: weighted sum 0–100. Written to `SeoScore`. Individual issues written to `SeoIssue` with severity (error / warning / info).

**Sitemap generation:**

Generates `<urlset>` with all published entries that have `SeoMeta.canonicalUrl` set. Includes `<lastmod>` from `updatedAt`. Served from cache (Redis, TTL 1h). Invalidated by BullMQ `kast.seo` job on publish/unpublish.

**Admin UI:**

- SEO panel in entry editor (WS-3 stub wired here): meta title + counter, meta description + counter, OG image picker, canonical URL input, robots (`index, follow` selectors), JSON-LD preview.
- Live score badge: after save, shows score 0–100 with color (red < 50, amber 50–74, green ≥ 75). Clicking the badge opens the issues list drawer.
- Redirects manager page (`/admin/seo/redirects`): table of rules, create/edit/delete drawer, test redirect button.
- Sitemap viewer page (`/admin/seo/sitemap`): rendered list of sitemap URLs with copy-all button.

**Out of scope this phase:**

- JSON-LD generation endpoint (Phase 3 hardening).
- SEO score history chart (Phase 3 audit UI).
- Per-type sitemap priority configuration (Phase 3).

**Acceptance:**

- `GET /api/v1/seo/sitemap.xml` returns valid XML with all published entries.
- `POST /api/v1/seo/validate/:entryId` enqueues a job; after processing, `GET /api/v1/seo/score/:entryId` returns a numeric score and list of issues.
- Score badge appears in the editor after draft save; red < 50, green ≥ 75.
- Create a redirect `301 /old-slug → /new-slug`; `GET /old-slug` returns 301 to `/new-slug`.
- `robots.txt` reflects the value stored in GlobalSettings.

**Tasks:**

1. `feat(api): seo module — SeoMeta CRUD and score endpoints`
2. `feat(api): seo validation BullMQ processor (kast.seo queue)`
3. `feat(api): sitemap.xml generation with redis cache`
4. `feat(api): robots.txt endpoint from GlobalSettings`
5. `feat(api): redirects API (CRUD) + redirect middleware in NestJS`
6. `feat(admin): seo panel in entry editor (meta, og, canonical, robots)`
7. `feat(admin): live seo score badge + issues drawer`
8. `feat(admin): redirects manager page`
9. `feat(admin): sitemap viewer page`

---

### WS-7 MCP Server — 15 Tools (PH2-04)

**Objective:** Ship the built-in MCP server so any MCP-compatible AI client (Claude.ai, Cursor, Cline, and other ai agents) can manage Kast content, schema, and settings via the Model Context Protocol.

**Tech decisions:**

- `@modelcontextprotocol/sdk` — official TypeScript MCP SDK.
- NestJS `McpModule`: a custom NestJS module that registers the MCP server and exposes it at `/mcp` as an SSE (Server-Sent Events) endpoint per the MCP transport spec.
- All 15 tools call the same NestJS services used by REST endpoints — no duplicate business logic.
- Dry-run mode: all mutating tools accept `dryRun: true` parameter. When set, the tool validates and simulates but does not persist. Result is returned as `{ dryRun: true, preview: { ... } }`.

**15 MCP Tools:**

| #   | Tool name               | Description                                         | Auth   |
| --- | ----------------------- | --------------------------------------------------- | ------ |
| 1   | `list_content_types`    | List all content type definitions                   | VIEWER |
| 2   | `get_content_type`      | Get a single content type with its fields           | VIEWER |
| 3   | `create_content_type`   | Create a new content type with fields               | ADMIN  |
| 4   | `update_content_type`   | Update a content type name/description/fields       | ADMIN  |
| 5   | `list_content_entries`  | List entries for a type, with filter and pagination | VIEWER |
| 6   | `get_content_entry`     | Get a single content entry with all locale data     | VIEWER |
| 7   | `create_content_entry`  | Create a new entry (status = DRAFT)                 | EDITOR |
| 8   | `update_content_entry`  | Update entry fields by entry ID                     | EDITOR |
| 9   | `publish_content_entry` | Publish or unpublish an entry                       | EDITOR |
| 10  | `delete_content_entry`  | Soft-delete (trash) a content entry                 | ADMIN  |
| 11  | `list_media`            | List media files with optional folder filter        | VIEWER |
| 12  | `get_media_file`        | Get metadata for a single media file                | VIEWER |
| 13  | `get_seo_score`         | Get the latest SEO score and issues for an entry    | VIEWER |
| 14  | `validate_seo`          | Trigger SEO validation job and await result         | EDITOR |
| 15  | `get_audit_log`         | Query the audit log with filters                    | ADMIN  |

**Scope:**

- `apps/api/src/modules/mcp/` — `MpcModule`, `McpService`, `McpController` (SSE transport).
- Each tool registered as a class method decorated with `@McpTool(...)` custom decorator.
- Tool input validated with Zod schemas.
- Tool output conforms to MCP `CallToolResult` shape with `content: [{ type: "text", text: JSON.stringify(result) }]`.
- Errors return `isError: true` with the standard Kast error envelope.
- All tool calls write to `AgentSession` (via `AgentTokens` RBAC guard from WS-14).
- `GET /mcp` — SSE endpoint (requires `Authorization: Bearer kastagent_...` or regular JWT).

**Out of scope this phase:**

- MCP resources and prompts (tools only in Phase 2).
- Streaming tool responses (future MCP spec extension).
- MCP inspector UI within the admin panel (Phase 3).

**Acceptance:**

- Claude.ai configured with Kast MCP server URL connects and lists all 15 tools.
- `list_content_types` returns the same data as `GET /api/v1/content-types`.
- `create_content_entry` with `dryRun: true` returns a preview without creating a DB row.
- All tool calls appear in `AgentSession` with the agent's token ID and timestamp.
- An agent token with VIEWER scope cannot call `create_content_entry` (returns `isError: true, code: FORBIDDEN`).

**Tasks:**

1. `feat(api): scaffold McpModule with @modelcontextprotocol/sdk`
2. `feat(api): SSE transport endpoint GET /mcp`
3. `feat(api): @McpTool decorator + tool registry`
4. `feat(api): tools 1-5 (list/get content types, create/update, list entries)`
5. `feat(api): tools 6-10 (get entry, create, update, publish, delete)`
6. `feat(api): tools 11-13 (list/get media, get seo score)`
7. `feat(api): tools 14-15 (validate seo, get audit log)`
8. `feat(api): dryRun mode across all mutating tools`
9. `feat(api): AgentSession logging on every tool call`

---

### WS-8 i18n Module + RTL Admin UI (PH2-05)

**Objective:** Make Kast fully multilingual — locale management API, per-field locale-aware content storage, and an admin UI that correctly renders RTL (Arabic, Hebrew) with zero layout breakage.

**Scope:**

**API endpoints (per [KAST_API_SPEC.md §12](../architecture/KAST_API_SPEC.md)):**

- `GET    /api/v1/locales` — list all configured locales
- `POST   /api/v1/locales` — create a locale
- `PATCH  /api/v1/locales/:code` — update a locale (name, isDefault, fallback)
- `DELETE /api/v1/locales/:code` — delete a non-default locale (cannot delete default)
- `POST   /api/v1/locales/:code/set-default` — make a locale the default

**Content entries with locales (already partially in Phase 1 schema):**

- Content entry creation: if the content type has `isLocalized: true`, an initial `ContentEntryLocale` row is created for the default locale.
- Locale-specific field data is stored in `ContentEntryLocale.data` (JSON).
- `GET /api/v1/content/:typeSlug/:id?locale=ar` returns the Arabic locale data (falling back to default locale data for untranslated fields, per the locale's `fallbackLocaleCode` chain).

**RTL admin UI:**

- HTML `dir` attribute on `<html>` set dynamically based on the active locale's `direction` field.
- All Tailwind classes use logical properties (enforced from WS-1; verified here across all WS-2 to WS-5 components).
- Tiptap rich text editor: direction auto-detected per locale; RTL mode sets `dir="rtl"` on the editor root.
- Sidebar and topbar flip correctly in RTL mode (validated manually in Arabic).
- `next-intl` adds Arabic translation strings for all admin UI labels (forms, buttons, nav items, errors).

**Out of scope this phase:**

- Machine translation integration (Phase 3 plugin).
- Translation status UI (showing which fields are untranslated per locale) — Phase 3.
- Locale-specific SEO meta editing (falls naturally out of this workstream; tested in S7 demo).

**Acceptance:**

- Create locale `ar` (Arabic, RTL, fallback: `en`). Admin UI switches to RTL; sidebar flips; all labels appear in Arabic.
- Create a `blog-post` entry with i18n enabled: English body in the `en` tab, Arabic body in the `ar` tab. `GET /api/v1/content/blog-post/:id?locale=ar` returns Arabic data.
- `DELETE /api/v1/locales/en` returns `400 CANNOT_DELETE_DEFAULT_LOCALE`.
- `GET /api/v1/content/blog-post/:id?locale=ar` for an entry with no Arabic `ContentEntryLocale` row falls back to the English value (per fallback chain).

**Tasks:**

1. `feat(api): locales CRUD API (list, create, update, delete, set-default)`
2. `feat(api): locale-aware content entry GET with fallback chain`
3. `feat(api): ContentEntryLocale creation on entry POST for all active locales`
4. `feat(admin): locale manager page (/admin/settings/locales)`
5. `feat(admin): dynamic dir="rtl" on html element based on active locale`
6. `feat(admin): arabic translations via next-intl`
7. `feat(admin): tiptap rtl direction mode`
8. `test(admin): rtl layout audit on all admin pages`

---

### WS-9 Draft / Publish / Schedule Workflow (PH2-06)

**Objective:** Implement the full publish lifecycle state machine for content entries: DRAFT → PUBLISHED → ARCHIVED, with the ability to schedule future publishing via BullMQ.

**Scope:**

**Status machine transitions (enforced at service layer):**

```
DRAFT ──────────────────────────────→ PUBLISHED (via publish action or scheduled)
DRAFT ──────────────────────────────→ ARCHIVED  (via archive action)
PUBLISHED ──────────────────────────→ DRAFT     (via unpublish action)
PUBLISHED ──────────────────────────→ ARCHIVED  (via archive action)
ARCHIVED ───────────────────────────→ DRAFT     (via restore action)
```

**API additions:**

- `POST /api/v1/content/:typeSlug/:id/publish` — immediately publish (EDITOR+)
- `POST /api/v1/content/:typeSlug/:id/unpublish` — move back to DRAFT (EDITOR+)
- `POST /api/v1/content/:typeSlug/:id/archive` — archive (ADMIN+)
- `POST /api/v1/content/:typeSlug/:id/schedule` — body: `{ publishAt: ISO8601 }`. Enqueues a delayed job in BullMQ `kast.publish` (EDITOR+)
- `DELETE /api/v1/content/:typeSlug/:id/schedule` — cancel a scheduled publish (EDITOR+)

**BullMQ `kast.publish` queue processor:**

- Delayed job fires at `publishAt` timestamp.
- Processor fetches entry, checks it is still DRAFT (not already published/trashed), transitions to PUBLISHED, writes audit log, triggers webhook event `content.published`.
- On failure (entry deleted before schedule fires): job marks itself as stale and logs a warning.

**Entry list filtering:**

- `GET /api/v1/content/:typeSlug?status=draft` — filter by status (all statuses supported).
- Default filter for public delivery API (`GET /api/v1/delivery/:typeSlug`) automatically excludes DRAFT and ARCHIVED — only PUBLISHED entries returned.

**Admin UI:**

- Status badge on entry cards: `DRAFT` (gray), `PUBLISHED` (green), `ARCHIVED` (amber), `SCHEDULED` (blue with datetime tooltip).
- Action bar in editor: context-sensitive buttons — if DRAFT: **Save Draft** + **Publish** + **Schedule**. If PUBLISHED: **Unpublish** + **Archive**. If ARCHIVED: **Restore to Draft**.
- Schedule picker: datetime input (respects locale timezone). Shows confirmation: "This post will be published on [date]. You can cancel this by reopening the entry."

**Acceptance:**

- Publish a DRAFT entry via the API: status becomes PUBLISHED; public delivery endpoint returns it; webhook event fires.
- Schedule entry to publish in 5 minutes: `kast.publish` job is enqueued with the correct delay; after 5 minutes, status is PUBLISHED.
- Cancel scheduled publish: job removed from BullMQ; status reverts to DRAFT.
- Public delivery API returns zero DRAFT entries even when called with a valid `X-Kast-Key`.

**Tasks:**

1. `feat(api): content entry status state machine (publish, unpublish, archive, restore)`
2. `feat(api): schedule publish endpoint + BullMQ kast.publish processor`
3. `feat(api): cancel schedule endpoint`
4. `feat(api): status filter on content list endpoints`
5. `feat(api): delivery API excludes non-published entries`
6. `feat(admin): status badge on entry list`
7. `feat(admin): context-sensitive action bar in entry editor`
8. `feat(admin): schedule picker with timezone awareness`

---

### WS-10 Version History + Revert (PH2-07)

**Objective:** Snapshot every save of a content entry and let editors revert to any previous version.

**Scope:**

**`ContentEntryVersion` model** (already in Phase 1 Prisma schema):

```
id          String
entryId     String
localeCode  String
data        Json       -- snapshot of ContentEntryLocale.data at save time
version     Int        -- sequential version number per entry + locale
createdAt   DateTime
createdByUserId String
createdByUser   User
```

**When a version is created:**

Every successful PATCH/PUT to a content entry that changes `data` writes a new `ContentEntryVersion` row. This happens inside a Prisma transaction: update the entry, snapshot the version. No version is written for status-only changes (publish/unpublish).

**API endpoints:**

- `GET  /api/v1/content/:typeSlug/:id/versions` — list versions for an entry (paginated, newest first) with `{ id, version, createdAt, createdBy: { name } }`.
- `GET  /api/v1/content/:typeSlug/:id/versions/:versionId` — get the full data snapshot for a specific version.
- `POST /api/v1/content/:typeSlug/:id/versions/:versionId/revert` — copy `data` from the version back to the current `ContentEntryLocale.data`. Creates a new version snapshot of the revert action. Entry status is set to DRAFT on revert.

**Admin UI:**

- Version history panel: collapsible sidebar panel in the entry editor (clock icon in action bar). Lists versions: `Version N — [Author] — [relative time]`. Clicking a version shows a preview (renders field values in read-only mode).
- Revert button per version: confirmation dialog "Revert to Version N? This will overwrite current draft content. Entry will be set to Draft." Confirms → live form updates to the reverted data.

**Out of scope this phase:**

- Side-by-side diff view (Phase 3 — nice-to-have).
- Version pruning (configurable retention — Phase 3).

**Acceptance:**

- Save a `blog-post` entry 5 times with different content. `GET .../versions` returns 5 rows newest-first.
- Revert to Version 2: entry editor shows Version 2 content; status badge shows DRAFT; new Version 6 row exists in the list.
- Revert is audited: `GET /api/v1/audit?action=CONTENT_REVERTED&entityId=...` returns the audit row.

**Tasks:**

1. `feat(api): ContentEntryVersion snapshot on every entry data change`
2. `feat(api): versions list + get-version endpoints`
3. `feat(api): revert-to-version endpoint`
4. `feat(admin): version history panel in entry editor`
5. `feat(admin): revert confirmation dialog + live form update`

---

### WS-11 BullMQ — All 6 Queues Operational (PH2-08)

**Objective:** Move all Phase 1 queue stubs to fully operational processors. Phase 1 registered the BullMQ module and queue names; Phase 2 wires the actual job processors, retry strategies, and dead-letter patterns.

**6 queues and their processors:**

| Queue          | Processor          | Jobs                    | Retry                                                                                              |
| -------------- | ------------------ | ----------------------- | -------------------------------------------------------------------------------------------------- |
| `kast.webhook` | `WebhookProcessor` | `deliver`               | 5 attempts, exponential backoff (1s, 2s, 4s, 8s, 16s). Dead-letter after 5 failures.               |
| `kast.media`   | `MediaProcessor`   | `optimize`, `thumbnail` | 3 attempts. Converts images to WebP. Generates thumbnails at 400px and 800px.                      |
| `kast.seo`     | `SeoProcessor`     | `validate`              | 2 attempts. Runs the SEO validation logic from WS-6. Writes `SeoScore` + `SeoIssue`.               |
| `kast.publish` | `PublishProcessor` | `publish`               | 2 attempts. Delayed jobs for scheduled publishing (WS-9).                                          |
| `kast.trash`   | `TrashProcessor`   | `permanent-delete`      | 1 attempt. Permanently deletes items trashed > 30 days ago. Runs via cron (daily at 02:00 UTC).    |
| `kast.email`   | `EmailProcessor`   | `send`                  | 3 attempts. Sends via configured SMTP (Phase 1 env: `SMTP_*`). Used for invite and password reset. |

**Scope per queue:**

- Processor class in `apps/api/src/modules/queue/processors/`.
- Dedicated BullMQ `Worker` registered in the corresponding NestJS module (not the Queue module — each module owns its processor: `SeoModule` owns `SeoProcessor`, etc.).
- `BullMQAdapter` in `QueueModule` exposes typed `enqueue(queue, job, data, options)` method used by services.
- Failed job events logged via NestJS Logger with job ID, error message, and attempt count.
- `kast.trash` cron job: registered via NestJS `@Cron` in `TrashModule`, enqueues daily cleanup jobs.

**Out of scope this phase:**

- Bull Board UI (Phase 3).
- Per-queue metrics in the admin panel (Phase 3).

**Acceptance:**

- Upload a JPEG: `kast.media/optimize` job fires; result is a WebP file stored at the same path + `.webp`. Two thumbnails written to `/thumbs/400/` and `/thumbs/800/`.
- Trigger `kast.seo/validate` for an entry: `SeoScore` row exists within 5 seconds.
- Deliver a webhook: `kast.webhook/deliver` job fires and sends HTTP POST to the registered URL with correct `X-Kast-Signature` header.
- Force a webhook failure: retry count visible in Redis; after 5 failures, job moves to dead-letter set.
- Invite a user: `kast.email/send` job fires; email delivered (or visible in SMTP test server in CI).

**Tasks:**

1. `feat(api): BullMQ typed enqueue helper in QueueModule`
2. `feat(api): kast.media processor (webp optimize + thumbnails via sharp)`
3. `feat(api): kast.seo processor (validation logic from WS-6)`
4. `feat(api): kast.publish processor (delayed publish, wired from WS-9)`
5. `feat(api): kast.trash processor + daily cron (30-day hard delete)`
6. `feat(api): kast.email processor (SMTP via nodemailer)`
7. `feat(api): kast.webhook processor (http delivery, wired from WS-12)`
8. `chore(ci): add Redis service container for queue integration tests`

---

### WS-12 Webhook System (PH2-09)

**Objective:** Allow developers and integrations to receive real-time notifications for CMS events via outbound HTTP webhooks with HMAC signature verification.

**Scope:**

**API endpoints (per [KAST_API_SPEC.md §13](../architecture/KAST_API_SPEC.md)):**

- `GET    /api/v1/webhooks` — list webhooks
- `POST   /api/v1/webhooks` — create webhook (url, events[], secret auto-generated)
- `GET    /api/v1/webhooks/:id` — get webhook
- `PATCH  /api/v1/webhooks/:id` — update webhook
- `DELETE /api/v1/webhooks/:id` — delete webhook
- `POST   /api/v1/webhooks/:id/test` — send a `webhook.test` event immediately
- `GET    /api/v1/webhooks/:id/deliveries` — list recent delivery attempts (last 100)

**Event types fired:**

| Event                 | Fired when                |
| --------------------- | ------------------------- |
| `content.created`     | New content entry created |
| `content.updated`     | Entry data changed        |
| `content.published`   | Entry moved to PUBLISHED  |
| `content.unpublished` | Entry moved back to DRAFT |
| `content.trashed`     | Entry soft-deleted        |
| `media.uploaded`      | New media file saved      |
| `user.created`        | New user created          |
| `webhook.test`        | Manual test fire          |

**Delivery payload:**

```json
{
  "id": "<delivery-uuid>",
  "event": "content.published",
  "timestamp": "2026-04-24T12:00:00.000Z",
  "data": { "entryId": "...", "typeSlug": "...", "locale": "en", "status": "PUBLISHED" }
}
```

**HMAC signing:**

- `X-Kast-Signature: sha256=<HMAC-SHA256(payload, secret)>`
- Secret auto-generated at webhook creation (32-byte random hex), stored as SHA-256 hash, shown once at creation.

**Retry strategy:**

Handled by `kast.webhook` processor (WS-11): 5 attempts, exponential backoff. Delivery status per attempt written to a delivery log in Redis (last 100 per webhook, TTL 7 days). Delivery log exposed via the `GET /api/v1/webhooks/:id/deliveries` endpoint.

**Admin UI:**

- Webhooks page (`/admin/webhooks`): list of webhooks with name, URL, event count, last delivery status (success/failure/pending). Create webhook button.
- Create/edit webhook drawer: URL input, event checkboxes, active toggle. Secret shown once on creation in a modal.
- Delivery log panel: per webhook, table of recent deliveries with timestamp, event, HTTP status code, response time, retry count. Re-deliver button per row.

**Acceptance:**

- Create a webhook listening on `content.published`. Publish a content entry. Webhook receives HTTP POST within 3 seconds with correct event, payload, and valid `X-Kast-Signature`.
- Delivery log shows the delivery with HTTP 200 response.
- Set the webhook URL to an unreachable server: 5 delivery attempts visible in delivery log with exponential delays.
- `POST /api/v1/webhooks/:id/test` sends a `webhook.test` event immediately regardless of retry state.

**Tasks:**

1. `feat(api): webhooks CRUD API`
2. `feat(api): webhook event bus (NestJS EventEmitter wiring to BullMQ enqueue)`
3. `feat(api): HMAC-SHA256 signing of webhook payloads`
4. `feat(api): delivery log in Redis (last 100 per webhook)`
5. `feat(api): deliveries list endpoint + re-deliver endpoint`
6. `feat(admin): webhooks page — list, create, edit, delete`
7. `feat(admin): delivery log panel with re-deliver button`

---

### WS-13 Plugin System v1 (PH2-10)

**Objective:** Establish the plugin architecture so third-party code can extend Kast without forking it — defining the manifest, the extension points, and the sandboxed execution model.

**Scope:**

**Plugin manifest (`kast-plugin.json`):**

```json
{
  "name": "@kast-cms/plugin-meilisearch",
  "version": "1.0.0",
  "displayName": "Meilisearch",
  "description": "Full-text search via Meilisearch",
  "permissions": ["content:read", "settings:read"],
  "hooks": ["content.created", "content.updated", "content.deleted"],
  "adminPages": [{ "label": "Search", "path": "/admin/plugins/search", "icon": "search" }],
  "env": ["MEILISEARCH_HOST", "MEILISEARCH_MASTER_KEY"]
}
```

**Extension points (Phase 2):**

| Hook              | Description                                |
| ----------------- | ------------------------------------------ |
| `content.created` | Plugin receives the full new entry payload |
| `content.updated` | Plugin receives before/after entry payload |
| `content.deleted` | Plugin receives the deleted entry ID       |
| `media.uploaded`  | Plugin receives the new media file record  |

**Plugin lifecycle:**

- Plugins are NestJS dynamic modules loaded at startup from the `plugins/` directory.
- A plugin registers itself by exporting a `KastPlugin` class implementing the `IKastPlugin` interface.
- `IKastPlugin` has `onLoad(app: INestApplication): Promise<void>` — called on startup after all core modules are ready.
- Hooks are delivered via NestJS EventEmitter — plugins subscribe in `onLoad`.
- Admin UI pages declared in the manifest are rendered by a plugin shell route in `apps/admin/plugins/[pluginId]/page.tsx` that loads the plugin's remote entry via Module Federation (Phase 3 full implementation; Phase 2 just establishes the route shell).

**`@kast-cms/plugin-sdk` package:**

New package `packages/plugin-sdk/` with:

- `IKastPlugin` interface
- `KastPluginContext` type (access to KastService instances the plugin is permitted to use)
- `PluginPermission` enum
- `PluginHook` enum
- Zod schema for `kast-plugin.json` manifest validation

**Plugin API endpoints:**

- `GET    /api/v1/plugins` — list installed plugins with status (ADMIN+)
- `POST   /api/v1/plugins/:name/enable` — enable a plugin (SUPER_ADMIN)
- `POST   /api/v1/plugins/:name/disable` — disable a plugin (SUPER_ADMIN)

**Out of scope this phase:**

- Plugin marketplace / NPM install flow (Phase 3).
- Module Federation for remote plugin admin pages (Phase 3 — Phase 2 prepares the shell route only).
- Plugin config UI (Phase 3).
- Stripe, Meilisearch, Resend, R2, Sentry first-party plugins (Phase 3).

**Acceptance:**

- A skeleton plugin in `plugins/kast-plugin-example/` with the correct manifest loads at startup without crashing.
- The example plugin receives the `content.created` hook and logs the payload (visible in API logs).
- `GET /api/v1/plugins` returns the example plugin with `status: "ENABLED"`.
- A plugin that requests `settings:write` permission (not in the permitted set) causes startup to reject with a clear error.

**Tasks:**

1. `feat(sdk): scaffold @kast-cms/plugin-sdk package with IKastPlugin interface and types`
2. `feat(api): plugin loader — scan plugins/ directory at startup`
3. `feat(api): plugin lifecycle (onLoad, hook subscription via EventEmitter)`
4. `feat(api): plugin permission enforcement (declared vs. granted)`
5. `feat(api): plugins list/enable/disable API`
6. `feat(admin): plugin shell route /admin/plugins/[pluginId]`
7. `feat(plugin): example plugin (kast-plugin-example) with content hooks`

---

### WS-14 Agent Tokens + MCP RBAC (PH2-11)

**Objective:** Issue scoped, revocable agent tokens for AI agents accessing the MCP server, with fine-grained permission control distinct from regular API tokens.

**Scope:**

**Agent tokens (`kastagent_...`):**

- Format: `kastagent_<random_32_chars>`
- Stored as SHA-256 hash in `AgentToken` model (per security model §4).
- No expiry by default; revoked manually.
- Scopes: each token has a list of MCP tool names it may call. An attempt to call an out-of-scope tool returns `isError: true, code: FORBIDDEN`.
- Agent token strategy: a Passport strategy `AgentTokenStrategy` added alongside the existing `JwtStrategy` and `ApiTokenStrategy`. Extracts token from `Authorization: Bearer kastagent_...` header.

**`AgentToken` model** (already in Phase 1 schema):

```
id        String    @id @default(cuid())
name      String
hash      String    @unique
prefix    String
scopes    String[]  -- array of MCP tool names e.g. ["list_content_entries", "get_content_entry"]
createdByUserId String
revokedAt DateTime?
createdAt DateTime  @default(now())
```

**API endpoints (per [KAST_API_SPEC.md §11](../architecture/KAST_API_SPEC.md)):**

- `GET    /api/v1/agent-tokens` — list agent tokens (prefix + name only, never hash) (ADMIN+)
- `POST   /api/v1/agent-tokens` — create agent token (name, scopes[]). Returns full token ONCE. (ADMIN+)
- `DELETE /api/v1/agent-tokens/:id` — revoke agent token (ADMIN+)

**`AgentSession` logging:**

Every MCP tool call creates or extends an `AgentSession` record with:

- `agentTokenId`, `tool` called, `input` (sanitized — no secrets), `output` (truncated to 10KB), `dryRun` flag, `createdAt`.

**Admin UI:**

- Agent tokens page (`/admin/agent-tokens`): list of tokens (name, prefix, scopes summary, created, revoked status). Create button. Revoke button per row.
- Create agent token drawer: name input, scope checkboxes per MCP tool (grouped by category). Token value shown once in a modal after creation.

**Acceptance:**

- Create agent token with scopes `["list_content_entries", "get_content_entry"]`. Token authenticates on `/mcp`. `list_content_entries` tool call succeeds. `create_content_entry` returns `FORBIDDEN`.
- Revoke token: subsequent MCP requests with the revoked token return 401.
- All tool calls written to `AgentSession`.

**Tasks:**

1. `feat(api): AgentToken model service (hash, create, revoke, lookup)`
2. `feat(api): AgentTokenStrategy Passport strategy`
3. `feat(api): MCP guard — enforce per-tool scope from agent token`
4. `feat(api): agent tokens CRUD API`
5. `feat(api): AgentSession logging on every MCP tool call`
6. `feat(admin): agent tokens page — list, create, revoke`

---

### WS-15 Forms Module (PH2-12)

**Objective:** A built-in form builder so editors can create forms, collect submissions, and export data — without code.

**Scope:**

**API endpoints (per [KAST_API_SPEC.md §15](../architecture/KAST_API_SPEC.md)):**

- `GET    /api/v1/forms` — list forms (ADMIN+)
- `POST   /api/v1/forms` — create form (ADMIN+)
- `GET    /api/v1/forms/:id` — get form definition (VIEWER+)
- `PATCH  /api/v1/forms/:id` — update form (ADMIN+)
- `DELETE /api/v1/forms/:id` — delete form (ADMIN+)
- `POST   /api/v1/forms/:id/submit` — submit a form (PUBLIC — rate limited to 10 req/min per IP)
- `GET    /api/v1/forms/:id/submissions` — list submissions with filters (ADMIN+)
- `DELETE /api/v1/forms/:id/submissions/:subId` — delete a submission (ADMIN+)
- `GET    /api/v1/forms/:id/submissions/export` — export as CSV (ADMIN+)

**Field types for forms:**

`text`, `email`, `textarea`, `number`, `date`, `select` (single/multi), `checkbox`, `radio`, `file` (single file upload), `hidden`.

**Spam protection:**

- Honeypot field: every form rendered client-side includes a hidden input. If populated, submission is silently discarded (returns 200 to avoid bots knowing they were caught).
- Rate limiting: `rateLimit.forms.max` (default 10/min per IP) per API spec.

**Admin UI:**

- Forms page (`/admin/forms`): list of forms with name, submission count, created date.
- Form builder (`/admin/forms/new`, `/admin/forms/:id`): drag-and-drop field list (same pattern as content type field builder in WS-2). Field options drawer. Preview pane (renders the form as it will appear).
- Submissions list: table with all submissions. Filter by date range. Per-row expand to see all field values. CSV export button. Delete submission button.

**Acceptance:**

- Create a `Contact Us` form with fields: `name (text, required)`, `email (email, required)`, `message (textarea)`. Submit the form via the public API. Submission appears in the admin submissions list.
- CSV export of submissions: downloads valid CSV with one row per submission, one column per field.
- Honeypot field populated: submission returns 200 but zero rows written to DB.
- Submit 11 times from the same IP in under 1 minute: 11th returns 429.

**Tasks:**

1. `feat(api): forms CRUD API`
2. `feat(api): form submission endpoint with honeypot + rate limit`
3. `feat(api): submissions list, delete, and CSV export`
4. `feat(admin): forms list page`
5. `feat(admin): form builder (drag-and-drop, field drawer, preview pane)`
6. `feat(admin): submissions list with export`

---

### WS-16 Menus Module (PH2-13)

**Objective:** A flexible menu builder for managing navigation hierarchies that frontends consume via the delivery API.

**Scope:**

**API endpoints (per [KAST_API_SPEC.md §16](../architecture/KAST_API_SPEC.md)):**

- `GET    /api/v1/menus` — list menus (VIEWER+)
- `POST   /api/v1/menus` — create menu (ADMIN+)
- `GET    /api/v1/menus/:handle` — get full menu tree (PUBLIC — served via `X-Kast-Key`)
- `PATCH  /api/v1/menus/:id` — update menu (ADMIN+)
- `DELETE /api/v1/menus/:id` — delete menu (ADMIN+)
- `POST   /api/v1/menus/:id/items` — add menu item (ADMIN+)
- `PATCH  /api/v1/menus/:id/items/:itemId` — update item (ADMIN+)
- `DELETE /api/v1/menus/:id/items/:itemId` — delete item (ADMIN+)
- `POST   /api/v1/menus/:id/items/reorder` — batch reorder (ADMIN+) — body: `{ items: [{ id, parentId, order }] }`

**Menu item link types:**

- `content_entry` — links to a specific `ContentEntry` (resolved to slug at serve time)
- `external_url` — arbitrary URL string
- `anchor` — fragment like `#section-id`
- `custom` — freeform label + URL

**Tree structure:**

Menu items have `parentId` (nullable) and `order` (int). The `GET /menus/:handle` endpoint returns a nested tree. Max depth: 3 levels.

**Admin UI:**

- Menus page (`/admin/menus`): list of menus with handle, item count.
- Menu builder (`/admin/menus/:id`): visual nested tree with drag-and-drop reorder and nesting (indent/outdent). Add item button opens a drawer: select link type, fill in label + target.
- Inline label editing on each tree node.

**Acceptance:**

- Create a `main-nav` menu with 3 top-level items and 2 nested items under one of them.
- Drag an item to reorder: `POST .../items/reorder` fires; `GET /api/v1/menus/main-nav` returns updated order.
- Link a `content_entry` item to a published `blog-post` entry. Delivery response includes the resolved URL.
- `GET /api/v1/menus/main-nav` is accessible with an `X-Kast-Key` (no user auth required).

**Tasks:**

1. `feat(api): menus CRUD + menu items API`
2. `feat(api): nested tree resolver for GET /menus/:handle`
3. `feat(api): menu item reorder (batch update)`
4. `feat(admin): menus list page`
5. `feat(admin): menu builder with drag-and-drop nested tree`
6. `feat(admin): add menu item drawer (all link types)`

---

### WS-17 Trash + 30-day Recovery (PH2-14)

**Objective:** Implement the full soft-delete lifecycle — trash, restore, and automatic hard-delete after 30 days — across ContentEntry, MediaFile, User, and Form.

**Scope:**

**Soft-delete enforcement (all services, per CR-06):**

- All `findMany` queries automatically add `WHERE trashedAt IS NULL` via Prisma middleware (global query extension that filters trashed records by default).
- Explicit `includetrashed: true` query param on list endpoints bypasses the filter (ADMIN+ only).

**Trash API endpoints (per [KAST_API_SPEC.md §19](../architecture/KAST_API_SPEC.md)):**

- `GET    /api/v1/trash` — list all trashed items across all models (ADMIN+), paginated, filterable by model type
- `POST   /api/v1/trash/:model/:id/restore` — restore a trashed item (ADMIN+). Sets `trashedAt = null`, `trashedByUserId = null`.
- `DELETE /api/v1/trash/:model/:id` — immediately and permanently delete (SUPER_ADMIN only). Cannot be undone.

**30-day cleanup:**

- BullMQ `kast.trash` processor (WS-11) runs daily via cron at 02:00 UTC.
- Processor queries all models with `trashedAt < NOW() - 30 days` and permanently deletes them.
- For `MediaFile`: S3/local file is deleted before the DB row.
- For `ContentEntry`: all `ContentEntryLocale`, `ContentEntryVersion`, `ContentRelation`, `SeoMeta`, `MediaUsage` rows are cascade-deleted.
- Audit log entry written for each permanent deletion.

**Admin UI:**

- Global trash page (`/admin/trash`): tabs per model type (Content, Media, Users, Forms). Each tab: table of trashed items with name, trashed date, trashed by, "Restores in X days" countdown. Restore and Permanently Delete buttons per row.
- Module-level trash: entry list pages have a `Show Trashed` toggle that shows soft-deleted items with a red tint and restore action.

**Acceptance:**

- Trash a `blog-post` entry. It disappears from the default content list. `GET /admin/trash` (Content tab) shows it with countdown.
- Restore: entry reappears in the content list with its original status (DRAFT/PUBLISHED preserved).
- Permanently delete via API (SUPER_ADMIN): entry gone from DB; audit log shows `CONTENT_PERMANENTLY_DELETED`.
- Mock a `trashedAt` timestamp 31 days ago: `kast.trash` cron processor permanently deletes it on next run; media file deleted from storage.

**Tasks:**

1. `feat(api): global Prisma middleware for trashedAt filter`
2. `feat(api): trash list API (all models, paginated, filterable)`
3. `feat(api): restore endpoint per model`
4. `feat(api): permanent delete endpoint (SUPER_ADMIN)`
5. `feat(api): kast.trash cron processor for 30-day hard delete (wired from WS-11)`
6. `feat(admin): global trash page with model tabs`
7. `feat(admin): show-trashed toggle on entry list and media library`

---

### WS-18 `@kast-cms/sdk` v0.2

**Objective:** Update the TypeScript SDK to cover every Phase 2 API endpoint with full type safety, so a developer using the SDK never needs to write a raw `fetch` call.

**Scope:**

New `KastClient` method groups added in `packages/sdk/src/`:

| Group                | Methods                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `client.seo`         | `getMeta`, `upsertMeta`, `getScore`, `validate`, `getRedirects`, `createRedirect`, `updateRedirect`, `deleteRedirect` |
| `client.locales`     | `list`, `create`, `update`, `delete`, `setDefault`                                                                    |
| `client.webhooks`    | `list`, `create`, `get`, `update`, `delete`, `test`, `getDeliveries`                                                  |
| `client.plugins`     | `list`, `enable`, `disable`                                                                                           |
| `client.agentTokens` | `list`, `create`, `revoke`                                                                                            |
| `client.forms`       | `list`, `create`, `get`, `update`, `delete`, `submit`, `getSubmissions`, `deleteSubmission`, `exportCsv`              |
| `client.menus`       | `list`, `create`, `get`, `update`, `delete`, `addItem`, `updateItem`, `deleteItem`, `reorderItems`                    |
| `client.trash`       | `list`, `restore`, `permanentDelete`                                                                                  |
| `client.users`       | `list`, `invite`, `get`, `update`, `suspend`, `activate`                                                              |
| `client.roles`       | `list`, `create`, `update`, `delete`                                                                                  |
| `client.apiTokens`   | `list`, `create`, `revoke`                                                                                            |
| `client.versions`    | `list`, `get`, `revert`                                                                                               |

**SDK versioning:**

- Bump `packages/sdk/package.json` version to `0.2.0`.
- All new types exported from `packages/sdk/src/index.ts`.
- Regenerate OpenAPI client types from the NestJS Swagger spec (`pnpm --filter @kast-cms/api swagger:export` → `pnpm --filter @kast-cms/sdk types:generate`).

**Acceptance:**

- A Node.js script using only `@kast-cms/sdk` can: authenticate, create a content type, create an entry, upload a media file, publish the entry, submit a form, and list the audit log — all with correct TypeScript types and zero `any`.
- SDK e2e test suite (new file `packages/sdk/tests/e2e.phase2.ts`) runs against the full Docker Compose stack and passes in CI.

**Tasks:**

1. `feat(sdk): add seo, locales, webhooks client groups`
2. `feat(sdk): add plugins, agent-tokens client groups`
3. `feat(sdk): add forms, menus, trash client groups`
4. `feat(sdk): add users, roles, api-tokens, versions client groups`
5. `feat(sdk): bump version to 0.2.0, update exports`
6. `test(sdk): phase 2 e2e test suite`
7. `chore(ci): add sdk phase 2 e2e to ci workflow`

---

## 5. Sprint Breakdown (10 weeks)

Each sprint = 1 week. Multiple workstreams run in parallel where dependencies allow.

| Sprint  | Theme                                | Workstreams in Flight | Exit Demo                                                                                                             |
| ------- | ------------------------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **S1**  | Admin Shell                          | WS-1                  | `pnpm --filter @kast-cms/admin dev` boots at `localhost:3001/admin`; login works; sidebar renders with stub nav links |
| **S2**  | Content Modeling UI                  | WS-2                  | Create a `blog-post` content type with 5 fields via the admin UI; fields saved, reordered, and rendered correctly     |
| **S3**  | Editorial UI                         | WS-3                  | Create, edit, and save a `blog-post` entry via the UI; rich text renders; media picker opens                          |
| **S4**  | Media + Users                        | WS-4, WS-5            | Upload 3 images via drag-and-drop; invite a user with EDITOR role; custom role created                                |
| **S5**  | SEO + Publish Workflow               | WS-6, WS-9            | SEO score badge visible in entry editor; publish action transitions status; schedule publish enqueues BullMQ job      |
| **S6**  | MCP + Agent Tokens                   | WS-7, WS-14           | Claude.ai connects to `/mcp`; all 15 tools listed; agent token with scoped permissions created and enforced           |
| **S7**  | i18n + BullMQ Queues                 | WS-8, WS-11           | Admin UI switches to Arabic RTL; all 6 BullMQ queues have running processors; image upload triggers WebP conversion   |
| **S8**  | Webhooks + Version History           | WS-12, WS-10          | Webhook fires on content publish with HMAC signature; version history panel shows past saves; revert works            |
| **S9**  | Forms + Menus + Trash                | WS-15, WS-16, WS-17   | Contact form submits and appears in submissions list; main-nav menu built with nested items; trashed entry restored   |
| **S10** | Plugin System + SDK v0.2 + Hardening | WS-13, WS-18          | Example plugin loads and receives hooks; `@kast-cms/sdk` v0.2 e2e suite passes; CI green on all checks                |

---

## 6. Phase 2 Exit Criteria

Lifted directly from [KAST_PRD.md §4](../architecture/KAST_PRD.md), expanded to be testable.

| ID    | Criterion                                                                | Verified By                                                                    |
| ----- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| EX-1  | Admin panel works end-to-end for creating types, entries, and publishing | Playwright e2e: create type → create entry → publish flow                      |
| EX-2  | SEO score appears before publish in the entry editor                     | e2e: save draft → score badge visible with numeric value                       |
| EX-3  | MCP server responds to all 15 tools from an MCP-compatible client        | Integration test: connect to `/mcp` with test agent token, call each tool      |
| EX-4  | RTL content types display correctly in Arabic admin UI                   | Manual QA + Playwright screenshot comparison in RTL mode                       |
| EX-5  | Webhooks deliver with HMAC signature                                     | e2e: create webhook → publish entry → assert delivery + signature verification |
| EX-6  | Trashed items are recoverable within 30 days                             | e2e: trash entry → restore → verify in content list                            |
| EX-7  | All 6 BullMQ queues have active processors with retry config             | Integration test: trigger each queue job; verify retry on failure              |
| EX-8  | Plugin system loads a conformant plugin at startup                       | Startup test: example plugin loaded; hook receives events                      |
| EX-9  | `@kast-cms/sdk` v0.2 e2e suite passes against full Docker Compose stack  | CI: sdk e2e job passes                                                         |
| EX-10 | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` all green    | CI: all checks pass on the merge commit closing Phase 2                        |

---

## 7. Cross-Cutting Requirements Compliance

| CR    | Requirement                | Phase 2 Implementation                                                                                                                       |
| ----- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| CR-01 | TypeScript strict          | `apps/admin` tsconfig extends base strict config; `noUnusedLocals`, `noImplicitAny`, `exactOptionalPropertyTypes` enforced                   |
| CR-02 | Audit every mutation       | `AuditInterceptor` already global; Phase 2 adds audit events for: publish, revert, restore, plugin enable/disable, agent token create/revoke |
| CR-03 | Three-layer security       | Admin UI communicates via SDK which hits the API's existing CORS + throttle + auth stack. MCP adds `AgentTokenStrategy`.                     |
| CR-04 | BullMQ for background work | All Phase 2 background ops go through queues: SEO validation, image optimization, webhook delivery, scheduled publish, email, trash cleanup  |
| CR-05 | Consistent error shape     | MCP errors return the standard envelope inside `isError: true` tool result. Admin UI shows toasts derived from the error envelope            |
| CR-06 | Soft delete with trash     | Prisma middleware enforces `trashedAt IS NULL` globally. Trash module (WS-17) provides restore + 30-day BullMQ cleanup                       |
| CR-07 | i18n ready                 | `next-intl` in admin UI ships in English + Arabic. Additional locales addable via locale manager                                             |
| CR-08 | RTL support                | CSS logical properties enforced via ESLint plugin. RTL verified in Arabic with `dir="rtl"` on `<html>`                                       |
| CR-09 | Zero `console.log`         | ESLint rule unchanged. MCP tool processors use NestJS Logger                                                                                 |
| CR-10 | Env validated on startup   | `apps/admin` requires `NEXT_PUBLIC_API_URL` and `AUTH_SECRET`; validated at build time via Zod in `apps/admin/src/config/env.ts`             |

---

## 8. Risks & Mitigations

| Risk                                                             | Likelihood | Impact | Mitigation                                                                                                                           |
| ---------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Admin UI scope creep (editors request pixel-perfect tweaks)      | High       | Med    | Freeze admin UI design in S1 with shadcn defaults; schedule polish for Phase 3                                                       |
| MCP SDK breaking changes between drafts                          | Med        | Med    | Pin `@modelcontextprotocol/sdk` exact version; abstract behind `McpAdapter` so upgrades stay isolated                                |
| RTL layout regressions on new admin components                   | Med        | Med    | ESLint `eslint-plugin-logical-css` catches violations at lint time; CI runs Playwright in RTL mode from S7 onward                    |
| BullMQ job loss on Redis restart (no persistence)                | Med        | High   | Enable Redis AOF persistence in `docker-compose.yml`; document in `.env.example`; test failover in S10 hardening                     |
| Plugin sandbox not truly isolated (NestJS modules share process) | High       | Med    | Document clearly: Phase 2 plugin sandboxing is permission-based, not process-based. True isolation (VM2/sub-process) is Phase 3      |
| Tiptap ProseMirror JSON migration complexity                     | Low        | Med    | Store raw ProseMirror JSON in `ContentEntryLocale.data`; rendering is the frontend's concern; no migration risk until schema changes |
| Playwright flakiness in CI for admin e2e tests                   | High       | Low    | Run Playwright with `--retries 2`; use `waitForResponse` patterns over `waitForTimeout`; dedicate a slow CI job                      |
| 10-week timeline pressure causing quality shortcuts              | High       | High   | Phase 2 exit criteria are non-negotiable; cut admin UI features before cutting security or test coverage                             |

---

## 9. Definition of Done

A workstream is **done** only when every item below is true:

- [ ] All API endpoints implemented per [KAST_API_SPEC.md](../architecture/KAST_API_SPEC.md) shape.
- [ ] Permissions enforced per [KAST_SECURITY_MODEL.md](../architecture/KAST_SECURITY_MODEL.md).
- [ ] Unit tests for every NestJS service method with branching logic.
- [ ] e2e tests (Playwright for admin UI, Supertest for API) covering happy path + at least 2 error paths per endpoint.
- [ ] No `any`, no `@ts-ignore`, no `console.log` in production code.
- [ ] No `ml-`, `mr-`, `pl-`, `pr-` Tailwind classes in `apps/admin` — only logical property equivalents.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` all pass locally.
- [ ] Audit interceptor verified to fire for new mutations.
- [ ] BullMQ jobs verified to enqueue and process in integration tests.
- [ ] SDK types updated if the workstream introduces new endpoints.
- [ ] PR reviewed by at least one other engineer; conventional commit on merge.

---

## 10. Branching & PR Strategy

- **Phase branch:** `phase-2-engine` (this branch). All Phase 2 work merges into here.
- **Feature branches:** `feat/<workstream>-<short-desc>` (e.g. `feat/ws7-mcp-15-tools`) cut from `phase-2-engine`.
- **PRs:** target `phase-2-engine`. Squash-merge with conventional commit subject.
- **Workstream ordering:** PRs for WS-2 through WS-17 should not be opened until WS-1 (`apps/admin` foundation) is merged. WS-11 (BullMQ) should be merged before WS-6 (SEO), WS-9 (publish), WS-12 (webhooks) since they all depend on specific queue processors.
- **Phase exit:** when all 10 exit criteria pass, open a single PR `phase-2-engine` → `develop`, then `develop` → `main`. Tag `v0.2.0-alpha` on `main`.
- **Hotfixes:** branch from `develop`, merge back to `develop` and rebase `phase-2-engine`.

---

_Plan owner: @kast-cms maintainers · Last updated: 2026-04-24_

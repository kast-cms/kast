# Phase 1 — The Engine

### _Working headless CMS. API-only. Developer-focused._

> Branch: `phase-1-engine` · Duration: Month 1–2 · Status: Planning
> References: [KAST_VISION.md](../architecture/KAST_VISION.md) · [KAST_PRD.md](../architecture/KAST_PRD.md) · [KAST_API_SPEC.md](../architecture/KAST_API_SPEC.md) · [KAST_DATABASE_SCHEMA.md](../architecture/KAST_DATABASE_SCHEMA.md) · [KAST_SECURITY_MODEL.md](../architecture/KAST_SECURITY_MODEL.md) · [KAST_DEV_STANDARDS.md](../architecture/KAST_DEV_STANDARDS.md)

---

## Table of Contents

1. [Goal & Scope](#1-goal--scope)
2. [Out of Scope (Defer to Phase 2/3)](#2-out-of-scope-defer-to-phase-23)
3. [Deliverable Map](#3-deliverable-map)
4. [Workstreams](#4-workstreams)
   - [WS-1 Monorepo & Tooling Foundation (PH1-01)](#ws-1-monorepo--tooling-foundation-ph1-01)
   - [WS-2 NestJS Core + Prisma + Postgres (PH1-02)](#ws-2-nestjs-core--prisma--postgres-ph1-02)
   - [WS-3 Auth + RBAC (PH1-05)](#ws-3-auth--rbac-ph1-05)
   - [WS-4 Content Types API (PH1-03)](#ws-4-content-types-api-ph1-03)
   - [WS-5 Content Entries API (PH1-04)](#ws-5-content-entries-api-ph1-04)
   - [WS-6 Media Upload (PH1-06)](#ws-6-media-upload-ph1-06)
   - [WS-7 Audit Log Foundation (PH1-07)](#ws-7-audit-log-foundation-ph1-07)
   - [WS-8 BullMQ + Redis Integration (PH1-10)](#ws-8-bullmq--redis-integration-ph1-10)
   - [WS-9 Docker Image + Compose (PH1-08)](#ws-9-docker-image--compose-ph1-08)
   - [WS-10 @kast/sdk v0.1 (PH1-09)](#ws-10-kastsdk-v01-ph1-09)
   - [WS-11 CI Pipeline (PH1-01)](#ws-11-ci-pipeline-ph1-01)
5. [Sprint Breakdown (8 weeks)](#5-sprint-breakdown-8-weeks)
6. [Phase 1 Exit Criteria](#6-phase-1-exit-criteria)
7. [Cross-Cutting Requirements Compliance](#7-cross-cutting-requirements-compliance)
8. [Risks & Mitigations](#8-risks--mitigations)
9. [Definition of Done](#9-definition-of-done)
10. [Branching & PR Strategy](#10-branching--pr-strategy)

---

## 1. Goal & Scope

Phase 1 ships a **headless, API-only** Kast CMS that a developer can run with `docker compose up`, authenticate against, define content types, create content entries, upload media, and consume from a TypeScript SDK. It establishes the architectural spine — every Phase 2/3 feature plugs into the foundation laid here.

**Done means:**

- A NestJS API with strict TypeScript, Prisma + Postgres, JWT auth, RBAC, content CRUD, media upload, and audit logging.
- A Redis-backed BullMQ runtime ready to host the queues introduced in Phase 2.
- A `@kast/sdk` package providing typed access to every Phase 1 endpoint.
- A reproducible Docker Compose stack (api + postgres + redis).
- CI green on every PR (lint, typecheck, unit tests, e2e auth + content smoke tests).

There is **no admin UI in Phase 1** (it lands in Phase 2). All verification is via REST + tests + SDK.

---

## 2. Out of Scope (Defer to Phase 2/3)

The following are intentionally **not** built in Phase 1, even though the schema/foundation may anticipate them:

| Deferred to | Item                                                               |
| ----------- | ------------------------------------------------------------------ |
| Phase 2     | Next.js admin panel                                                |
| Phase 2     | SEO module, sitemap, redirects, JSON-LD                            |
| Phase 2     | MCP server + agent tokens                                          |
| Phase 2     | i18n module + locale-aware fields                                  |
| Phase 2     | GraphQL API                                                        |
| Phase 2     | Draft/Publish state machine, version history, scheduled publishing |
| Phase 2     | Webhook delivery + HMAC signing                                    |
| Phase 2     | Plugin system (NestJS dynamic modules)                             |
| Phase 2     | Forms, Menus, Trash recovery, Global Settings UI                   |
| Phase 3     | `npx create-kast-app` CLI                                          |
| Phase 3     | OAuth (Google/GitHub) — only email/password in Phase 1             |
| Phase 3     | First-party plugins (Stripe, Meilisearch, Resend, R2, Sentry)      |
| Phase 3     | Frontend starter, one-click deploy buttons, public docs site       |

The Prisma schema in Phase 1 includes models needed for these features so migrations stay additive — but the _behavior_ is not implemented.

---

## 3. Deliverable Map

| PRD ID | Deliverable                        | Workstream  | Sprint |
| ------ | ---------------------------------- | ----------- | ------ |
| PH1-01 | Monorepo setup + CI pipeline       | WS-1, WS-11 | S1     |
| PH1-02 | NestJS core + Prisma + PostgreSQL  | WS-2        | S1–S2  |
| PH1-03 | Content types API (CRUD)           | WS-4        | S3     |
| PH1-04 | Content entries API (CRUD)         | WS-5        | S4     |
| PH1-05 | Auth (email/password + JWT + RBAC) | WS-3        | S2     |
| PH1-06 | Media upload (local + S3)          | WS-6        | S5     |
| PH1-07 | Audit log foundation               | WS-7        | S2–S3  |
| PH1-08 | Docker image + Compose             | WS-9        | S1, S6 |
| PH1-09 | `@kast/sdk` TypeScript client v0.1 | WS-10       | S5–S6  |
| PH1-10 | BullMQ + Redis integration         | WS-8        | S3     |

---

## 4. Workstreams

Each workstream lists: **objective**, **scope**, **out-of-scope-this-phase**, **acceptance**, and **tasks** (atomic, PR-sized).

---

### WS-1 Monorepo & Tooling Foundation (PH1-01)

**Objective:** A pnpm + Turborepo monorepo with strict TypeScript, ESLint v9 flat config, Prettier, Husky, lint-staged, and commitlint — exactly as specified in [KAST_DEV_STANDARDS.md](../architecture/KAST_DEV_STANDARDS.md).

**Scope:**

- `pnpm-workspace.yaml` covering `apps/*`, `packages/*`, `plugins/*` (already present — verify).
- `tsconfig.base.json` with the strict flag set from the standards doc.
- Root `eslint.config.ts` (flat config) + per-workspace overrides for `apps/api` and `packages/*`.
- `prettier.config.mjs` + `prettier-plugin-organize-imports`.
- `commitlint.config.ts` (conventional commits) — already present.
- `lint-staged.config.mjs` — already present.
- `.husky/pre-commit` runs `lint-staged`; `.husky/commit-msg` runs `commitlint`.
- Root `package.json` scripts: `dev`, `build`, `lint`, `lint:fix`, `typecheck`, `test`, `test:e2e`, `format`, `format:check` — already present, wire to Turbo.
- `turbo.json` pipeline with caching for `build`, `lint`, `typecheck`, `test`.

**Out of scope this phase:**

- Per-workspace `eslint.config.ts` for `apps/admin` (no admin in Phase 1).
- Changesets / release tooling (lands in Phase 3 alongside CLI).

**Acceptance:**

- `pnpm install` from a clean checkout completes without warnings.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` pass on an empty workspace.
- A trivial PR triggers Husky → lint-staged → commitlint locally.

**Tasks:**

1. `chore(repo): verify pnpm-workspace + tsconfig.base + turbo pipelines`
2. `chore(lint): add root eslint.config.ts (flat) per dev standards`
3. `chore(lint): add apps/api/eslint.config.ts NestJS overrides`
4. `chore(lint): add packages/eslint.config.ts shared overrides`
5. `chore(format): finalize prettier config + organize-imports plugin`
6. `chore(hooks): wire husky pre-commit (lint-staged) + commit-msg (commitlint)`

---

### WS-2 NestJS Core + Prisma + Postgres (PH1-02)

**Objective:** Bootstrap `apps/api` as a NestJS app with Prisma + Postgres, env validation, structured logging, Helmet, CORS, global error envelope, and rate limiting.

**Scope:**

- `apps/api/src/main.ts` — Helmet, CORS, global `ValidationPipe` (whitelist + forbidNonWhitelisted), global exception filter producing the standard error envelope.
- `apps/api/src/app.module.ts` — root module wiring.
- **`ConfigModule`** with Zod-validated env (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `NODE_ENV`, `PORT`, `STORAGE_DRIVER`). App refuses to start on invalid env (per CR-10).
- **`PrismaModule`** + `PrismaService` (singleton, graceful shutdown).
- **`LoggerModule`** — NestJS Logger with structured JSON output in production, pretty in dev.
- **`HealthModule`** — `GET /api/v1/health` (DB + Redis ping); CORS-exempt.
- **`ThrottlerModule`** (`@nestjs/throttler`) — three named buckets: `public`, `auth`, `admin`. Defaults per [KAST_API_SPEC.md §1 Layer 2](../architecture/KAST_API_SPEC.md).
- **Global error envelope** matching the API spec exactly:
  ```json
  { "error": { "code", "message", "statusCode", "timestamp", "path" } }
  ```
- **Prisma schema**: bring in _all 38 models_ from [KAST_DATABASE_SCHEMA.md §5](../architecture/KAST_DATABASE_SCHEMA.md). Migrations created but only Phase 1 modules use them.
- **Initial migration** committed under `apps/api/prisma/migrations/`.
- **Seed script** (`apps/api/prisma/seed.ts`): seed default `Locale` (en, ltr), 4 system `Role`s (SUPER_ADMIN, ADMIN, EDITOR, VIEWER), and a SUPER_ADMIN user from env (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`).

**Out of scope this phase:**

- Implementing service logic for SEO, MCP, i18n, Webhook, Plugin, Forms, Menus models — only the schema lands now.
- GraphQL (Phase 2).

**Acceptance:**

- `pnpm --filter api start:dev` boots cleanly with valid env, refuses with clear message on missing env.
- `GET /api/v1/health` returns `200 { data: { status: "ok", db: "ok", redis: "ok" } }`.
- `prisma migrate dev` creates all 38 tables.
- Seed produces a working SUPER_ADMIN.

**Tasks:**

1. `feat(api): scaffold NestJS app under apps/api`
2. `feat(api): add zod-based ConfigModule with startup env validation`
3. `feat(api): integrate Prisma + PrismaService with graceful shutdown`
4. `feat(api): port full Prisma schema (38 models) from KAST_DATABASE_SCHEMA`
5. `feat(api): generate initial migration`
6. `feat(api): add Logger (pretty dev / json prod)`
7. `feat(api): add Helmet, CORS, ValidationPipe, global exception filter (envelope)`
8. `feat(api): add ThrottlerModule with public/auth/admin buckets`
9. `feat(api): add HealthModule (db + redis) — CORS exempt`
10. `feat(api): add prisma seed (locales, roles, super admin)`

---

### WS-3 Auth + RBAC (PH1-05)

**Objective:** Implement stateless JWT + refresh token rotation and role-based guards exactly as defined in [KAST_SECURITY_MODEL.md §3–§5](../architecture/KAST_SECURITY_MODEL.md).

**Scope:**

- **Endpoints (per [API spec §2](../architecture/KAST_API_SPEC.md)):**
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/refresh`
  - `POST /api/v1/auth/logout`
  - `GET  /api/v1/auth/me`
- **Password hashing:** `argon2id` (preferred over bcrypt for new systems; document choice in ADR if deviating from spec wording).
- **Tokens:**
  - Access JWT: `HS256`, 15 min, payload `{ sub, email, roles, iat, exp, jti }`.
  - Refresh: opaque random 32-byte, stored as SHA-256 hash in `RefreshToken` model, 30-day expiry, rotated on every refresh.
- **Guards:**
  - `JwtAuthGuard` — verifies access token, attaches `request.user`.
  - `RolesGuard` + `@Roles(...)` decorator — supports the 4 system roles.
  - `Public()` decorator to opt routes out of `JwtAuthGuard`.
- **API tokens (`kast_...`):** model exists; minimal `ApiTokenStrategy` + `X-Kast-Key` header support so SDK and SSR clients work in Phase 1. Full management UI is Phase 2.
- **Rate limiting:** `auth` bucket applied to login/refresh endpoints.

**Out of scope this phase:**

- OAuth (Google/GitHub) — Phase 3.
- Agent tokens (`kastagent_...`) — Phase 2.
- Field-level permissions — Phase 2.
- Custom roles UI — Phase 2.

**Acceptance:**

- AC-AUT-\* equivalents from PRD: login returns access+refresh, refresh rotates, logout revokes, expired token returns `401`.
- Wrong password → `401 UNAUTHORIZED` (no user enumeration via timing).
- Auth endpoints rate-limited to `20 req / 15 min` per IP.

**Tasks:**

1. `feat(auth): AuthModule scaffold + DTOs (zod or class-validator)`
2. `feat(auth): argon2id password hashing utility`
3. `feat(auth): JWT access + refresh token services (hash storage)`
4. `feat(auth): login/refresh/logout/me endpoints`
5. `feat(auth): JwtAuthGuard + Public decorator (global guard registration)`
6. `feat(auth): RolesGuard + @Roles decorator + 4 system roles`
7. `feat(auth): ApiTokenStrategy for X-Kast-Key (read-only)`
8. `feat(auth): apply auth throttler bucket to login/refresh`
9. `test(auth): unit tests for token services + e2e for full login/refresh/logout flow`

---

### WS-4 Content Types API (PH1-03)

**Objective:** Implement CRUD for `ContentType` and its `ContentField` definitions, the foundation that every entry references.

**Scope:**

- **Endpoints:**
  - `GET    /api/v1/content-types` — list (cursor pagination)
  - `POST   /api/v1/content-types` — create (ADMIN+)
  - `GET    /api/v1/content-types/:slug` — read
  - `PATCH  /api/v1/content-types/:slug` — update (ADMIN+)
  - `DELETE /api/v1/content-types/:slug` — soft-archive (ADMIN+)
  - `POST   /api/v1/content-types/:slug/fields` — add field
  - `PATCH  /api/v1/content-types/:slug/fields/:fid` — update field
  - `DELETE /api/v1/content-types/:slug/fields/:fid` — remove field
- **Validation:**
  - `slug` regex: `^[a-z][a-z0-9-]*$`, unique.
  - Field `key` regex: `^[a-z][a-zA-Z0-9_]*$`, unique within type.
  - Field types restricted to `ContentFieldType` enum (Phase 1 supports: TEXT, RICH_TEXT, NUMBER, BOOLEAN, DATE, DATETIME, MEDIA, RELATION, JSON, SELECT, MULTI_SELECT, URL, EMAIL — defer COMPONENT, BLOCK to Phase 2).
- **Schema-aware DTO generation** for entries: a `SchemaService` builds a Zod validator per content type at request time, used by WS-5.
- **Cursor pagination** helper used here and across all list endpoints.

**Out of scope this phase:**

- COMPONENT and BLOCK field types.
- Field-level permissions.
- Schema migration tooling for existing entries when fields change (just allow + record; reconciliation is Phase 2).

**Acceptance:**

- AC-SCH equivalents from PRD: cannot create duplicate slug, cannot delete a content type with non-archived entries, cannot rename a field key (only label/required/options).
- All mutations write `AuditLog` (via WS-7 interceptor).

**Tasks:**

1. `feat(content-types): module + service + repository`
2. `feat(content-types): create/list/read/update/delete endpoints`
3. `feat(content-types): field add/update/remove endpoints`
4. `feat(content-types): SchemaService (build Zod validator from ContentType)`
5. `feat(common): cursor pagination helper`
6. `test(content-types): unit + e2e covering all 8 endpoints`

---

### WS-5 Content Entries API (PH1-04)

**Objective:** CRUD for `ContentEntry` records validated against their `ContentType` schema.

**Scope:**

- **Endpoints:**
  - `GET    /api/v1/content/:typeSlug` — list entries (cursor, filter by status)
  - `POST   /api/v1/content/:typeSlug` — create
  - `GET    /api/v1/content/:typeSlug/:id` — read
  - `PATCH  /api/v1/content/:typeSlug/:id` — update
  - `DELETE /api/v1/content/:typeSlug/:id` — soft-delete (`trashedAt`, `trashedByUserId`)
- **Validation:** entry payload validated against the live `SchemaService` for the type. Unknown fields rejected with `422 UNPROCESSABLE`.
- **Status:** Phase 1 ships only `DRAFT` (default) — no publish workflow yet (Phase 2). `status` field exists in schema but only `DRAFT` and `TRASHED` are reachable.
- **Locale handling:** all entries write a single `ContentEntryLocale` row keyed to the default locale (`en`). Multi-locale routing comes in Phase 2.
- **No version snapshots in Phase 1** — `ContentEntryVersion` model exists but is not written; this is a Phase 2 deliverable.
- **Permissions:** EDITOR+ for create/update; ADMIN+ for delete.

**Out of scope this phase:**

- Publish/unpublish/schedule, version history, relations CRUD UI (relation fields _can_ be set, but no rich relation manager).
- Public Content Delivery API (`/api/v1/cd/...`) — Phase 2 (depends on publish workflow).

**Acceptance:**

- Create rejects payload missing required fields with `400 VALIDATION_ERROR` listing each missing field.
- Soft-deleted entries excluded from default list, included with `?includeTrashed=true` (ADMIN+ only).

**Tasks:**

1. `feat(content): EntriesModule + service + repository`
2. `feat(content): create/list/read/update/soft-delete endpoints`
3. `feat(content): payload validation via SchemaService`
4. `feat(content): default-locale write to ContentEntryLocale`
5. `feat(content): trash semantics (exclude by default, include with flag)`
6. `test(content): unit + e2e (CRUD + validation + role checks)`

---

### WS-6 Media Upload (PH1-06)

**Objective:** File upload with pluggable storage (local FS in dev, S3-compatible in prod) and metadata persistence.

**Scope:**

- **Endpoints:**
  - `POST   /api/v1/media/upload` — multipart, single + multi (max 10 files / req)
  - `POST   /api/v1/media/from-url` — fetch by URL (size-capped, content-type checked)
  - `GET    /api/v1/media` — list (cursor, filter by folder)
  - `GET    /api/v1/media/:id` — read metadata
  - `DELETE /api/v1/media/:id` — soft-delete
  - `GET    /api/v1/media/folders` + `POST/DELETE` for `MediaFolder`
- **Storage abstraction:** `StorageService` interface with two adapters:
  - `LocalStorageAdapter` — writes to `STORAGE_LOCAL_PATH`, served via `/uploads/*`.
  - `S3StorageAdapter` — `@aws-sdk/client-s3`, works with AWS S3, Cloudflare R2, MinIO. Driver chosen by `STORAGE_DRIVER` env.
- **Validation:** MIME allow-list (`STORAGE_ALLOWED_MIME`), max file size (`STORAGE_MAX_BYTES`, default 25MB).
- **Persistence:** `MediaFile` row with `originalName`, `storedName`, `mime`, `size`, `width`/`height` (probed via `image-size` for images), `folderId`, `uploadedByUserId`.
- **No image processing in Phase 1** — Sharp resizing/WebP/alt-text generation lands in Phase 2 via the `kast.media` BullMQ queue (queue is wired in WS-8 but worker is empty).

**Out of scope this phase:**

- Sharp image processing, AI alt-text, usage tracking (`MediaUsage` table populated only when Content writes happen — basic insert OK, query UI is Phase 2).

**Acceptance:**

- Upload returns `{ id, url, mime, size }`. URL points to either `/uploads/...` (local) or signed S3 URL.
- Files larger than `STORAGE_MAX_BYTES` rejected `413 PAYLOAD_TOO_LARGE`.
- Disallowed MIME rejected `415 UNSUPPORTED_MEDIA_TYPE`.

**Tasks:**

1. `feat(media): MediaModule + StorageService interface`
2. `feat(media): LocalStorageAdapter + static file serving`
3. `feat(media): S3StorageAdapter (works with AWS/R2/MinIO)`
4. `feat(media): upload/from-url/list/read/delete endpoints`
5. `feat(media): folder CRUD endpoints`
6. `test(media): unit (adapters with mocked S3) + e2e (local upload + delete)`

---

### WS-7 Audit Log Foundation (PH1-07)

**Objective:** Immutable audit trail for every mutation across the API — fulfills CR-02.

**Scope:**

- **Global `AuditInterceptor`** registered on the app module. For every successful `POST/PATCH/PUT/DELETE` it writes an `AuditLog` row containing: `actorUserId`, `actorTokenId` (if API key), `action` (e.g. `content.create`), `entityType`, `entityId`, `diff` (shallow JSON), `ip`, `userAgent`, `createdAt`.
- **`@AuditAction('content.create')` decorator** to set the action label per route; default falls back to `<entityType>.<httpVerbToVerb>`.
- **Endpoints:**
  - `GET /api/v1/audit` — list (cursor, filters: `actorId`, `entityType`, `action`, `from`, `to`) — ADMIN+.
  - `GET /api/v1/audit/:id` — read — ADMIN+.
- **Async write path stub:** in Phase 1 audit writes happen _inline_ (synchronous Prisma insert). The `kast.audit` BullMQ queue is registered (WS-8) and a feature flag `AUDIT_ASYNC=true` switches to enqueue — left **off by default**; enabling proven in Phase 2 once queue workers harden.
- **Diff strategy:** for updates, diff = `{ before: <fields changed>, after: <new values> }`. Sensitive fields (`password`, `tokenHash`, `secret`) are redacted at the interceptor level.

**Out of scope this phase:**

- Export to JSON/CSV (Phase 3).
- Retention policy enforcement (Phase 2).
- Agent action attribution (`agentId` field exists; populated when MCP ships in Phase 2).

**Acceptance:**

- Every successful mutation across WS-3/4/5/6 produces exactly one `AuditLog` row.
- Failed requests (4xx/5xx) produce **no** audit row.
- Sensitive fields never appear in `diff`.

**Tasks:**

1. `feat(audit): AuditModule + AuditLog repository`
2. `feat(audit): global AuditInterceptor + @AuditAction decorator`
3. `feat(audit): list/read endpoints (ADMIN+)`
4. `feat(audit): redaction of sensitive fields in diffs`
5. `test(audit): interceptor coverage on each module + redaction unit test`

---

### WS-8 BullMQ + Redis Integration (PH1-10)

**Objective:** Wire the queue runtime so Phase 2 features can register workers without touching infrastructure code.

**Scope:**

- `RedisModule` exposing a shared `IORedis` client (consumed by both BullMQ and any future cache layer).
- `QueueModule` using `@nestjs/bullmq` registering the **6 named queues** from [VISION §7.1](../architecture/KAST_VISION.md):
  `kast.webhook`, `kast.media`, `kast.seo`, `kast.publish`, `kast.audit`, `kast.email` — plus `kast.trash` from [DB schema §3](../architecture/KAST_DATABASE_SCHEMA.md).
- **No workers implemented in Phase 1** — only the queue registration and Redis connection. Each Phase 2 module brings its own `Processor`.
- **Health check:** `/api/v1/health` includes `redis: "ok"` and verifies BullMQ can ping.
- **Queue dashboard not in Phase 1** (Bull Board is Phase 3 deliverable PH3-12).

**Out of scope this phase:**

- Any actual job processors (webhook delivery, media resize, etc.).
- Bull Board UI.

**Acceptance:**

- App boots and connects to Redis; `/health` reflects status.
- Producing a test job onto any of the 7 queues from a unit test succeeds.
- App degrades cleanly (logs error, returns `503` from health) if Redis is down — but does not crash.

**Tasks:**

1. `feat(queue): RedisModule (shared IORedis client)`
2. `feat(queue): QueueModule registering 7 named queues`
3. `feat(health): extend HealthModule to ping Redis + BullMQ`
4. `test(queue): integration test producing a noop job per queue`

---

### WS-9 Docker Image + Compose (PH1-08)

**Objective:** Reproducible dev + production-grade single-host deployment.

**Scope:**

- **`apps/api/Dockerfile`** — multi-stage:
  1. `deps` (pnpm fetch + install)
  2. `build` (turbo build --filter api)
  3. `runner` (distroless or `node:20-alpine`, non-root user, copy only `dist/`, `package.json`, `node_modules` (prod), `prisma/`)
     Entrypoint runs `prisma migrate deploy` then `node dist/main.js`.
- **Root `docker-compose.yml`** services:
  - `api` (built from `apps/api/Dockerfile`)
  - `postgres:16-alpine` with named volume + healthcheck
  - `redis:7-alpine` with named volume + healthcheck
  - Optional `mailhog` profile for dev email testing (no-op until Phase 2 email queue lands)
- **`docker-compose.dev.yml`** override that mounts source for live reload via `pnpm start:dev`.
- **`.env.example`** at repo root documenting every required variable from WS-2.
- **Healthchecks** on all three services so `depends_on: condition: service_healthy` works.

**Out of scope this phase:**

- Helm chart, k8s manifests, Railway/Render templates (Phase 3).

**Acceptance:**

- From a clean checkout: `cp .env.example .env && docker compose up -d` brings api + postgres + redis to healthy.
- `curl http://localhost:3000/api/v1/health` returns `200`.
- Image runs as non-root, image size < 300MB.

**Tasks:**

1. `chore(docker): multi-stage Dockerfile for apps/api`
2. `chore(docker): root docker-compose.yml + healthchecks`
3. `chore(docker): docker-compose.dev.yml override for hot reload`
4. `chore(env): .env.example with all Phase 1 vars documented`
5. `docs(deploy): README quickstart section`

---

### WS-10 `@kast/sdk` v0.1 (PH1-09)

**Objective:** A typed TypeScript client wrapping every Phase 1 endpoint, used internally by tests and externally by SSR consumers.

**Scope:**

- **Package:** `packages/sdk` published as `@kast/sdk` (private during Phase 1).
- **Transport:** `fetch` based, isomorphic (works in Node 20 + browsers + Next.js SSR).
- **Auth:** accepts `apiKey` (`X-Kast-Key`) **or** `accessToken` (`Authorization: Bearer`).
- **Resource clients:** `auth`, `contentTypes`, `content`, `media`, `audit`, `health`.
- **Types generated from OpenAPI:** NestJS exposes `/api/v1/openapi.json` via `@nestjs/swagger`. SDK build runs `openapi-typescript` → `src/__generated__/schema.d.ts`. Hand-written resource clients consume those types — no `any`, no manual duplication.
- **Errors:** every method throws a typed `KastError` carrying `code`, `statusCode`, `message`, `path`.
- **Versioning:** semver from day one, starts at `0.1.0`.

**Out of scope this phase:**

- React hooks package (`@kast/sdk/react`) — Phase 2 admin work.
- GraphQL client (Phase 2).

**Acceptance:**

- `pnpm --filter @kast/sdk build` emits ESM + CJS + `.d.ts`.
- Same code runs from a Node script and a Next.js Route Handler against a local API.
- Type-checking the SDK catches drift if an endpoint shape changes.

**Tasks:**

1. `feat(api): expose /openapi.json via @nestjs/swagger`
2. `feat(sdk): package scaffold (tsup build, dual ESM/CJS)`
3. `feat(sdk): openapi-typescript generation step`
4. `feat(sdk): KastClient + per-resource clients`
5. `feat(sdk): KastError class + typed throws`
6. `test(sdk): integration tests hitting a live in-process API (supertest server)`

---

### WS-11 CI Pipeline (PH1-01)

**Objective:** Every PR proves the repo is green before merge.

**Scope:**

- **`.github/workflows/ci.yml`** with a single job matrix:
  - Setup pnpm + Node 20.
  - `pnpm install --frozen-lockfile`.
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test` (unit)
  - `pnpm test:e2e` against ephemeral Postgres + Redis service containers.
  - Build Docker image (no push) on PRs.
- **Branch protection** (documented in PR description, applied by maintainer): require CI green + 1 review + linear history on `main` and `develop`.
- **Path filters** so doc-only PRs skip e2e.
- **Caching:** pnpm store + Turbo remote cache (local-only in Phase 1; remote cache wired in Phase 3).

**Out of scope this phase:**

- Release automation (Phase 3).
- Coverage reporting / Codecov (Phase 2 nice-to-have).

**Acceptance:**

- Opening a PR triggers all checks; checks finish in < 10 min on a cold cache.
- A failing lint/test/typecheck blocks merge (visible in PR UI).

**Tasks:**

1. `chore(ci): GitHub Actions workflow (lint/typecheck/test/e2e/build)`
2. `chore(ci): postgres + redis service containers for e2e`
3. `chore(ci): pnpm + turbo cache configuration`
4. `docs(repo): branch protection rules + PR template`

---

## 5. Sprint Breakdown (8 weeks)

Each sprint = 1 week. Workstreams overlap where dependencies allow.

| Sprint | Theme                         | Workstreams in Flight                      | Exit Demo                                                                                      |
| ------ | ----------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| **S1** | Foundations                   | WS-1, WS-2 (start), WS-9 (skeleton), WS-11 | `pnpm install` + `docker compose up postgres redis` runs; CI green on empty NestJS app         |
| **S2** | DB + Auth                     | WS-2 (finish), WS-3, WS-7 (start)          | Full schema migrated; login → access+refresh → `/me` works; audit row written for login        |
| **S3** | Content Types + Queue Wiring  | WS-4, WS-7 (finish), WS-8                  | Create a `blog-post` content type with fields via SDK-less curl; audit visible; Redis pingable |
| **S4** | Content Entries               | WS-5                                       | Create/read/update/soft-delete a blog post; validation rejects bad payloads                    |
| **S5** | Media + SDK Build-out         | WS-6, WS-10 (start)                        | Upload an image (local + S3-mocked); SDK can call all endpoints from a script                  |
| **S6** | SDK Polish + Docker Hardening | WS-10 (finish), WS-9 (finish)              | Docker image < 300MB, runs non-root; SDK e2e green; full quickstart in README                  |
| **S7** | Hardening                     | All — bug fixing, perf, docs               | All exit-criteria endpoints meet PF-\* targets; e2e suite > 90% pass on first run              |
| **S8** | Phase Exit                    | All — final review, ADRs                   | Phase 1 sign-off PR merged into `develop`; tag `v0.1.0-alpha`                                  |

---

## 6. Phase 1 Exit Criteria

Lifted directly from [KAST_PRD.md §4](../architecture/KAST_PRD.md), expanded to be testable.

| ID   | Criterion                                                                                            | Verified By                                  |
| ---- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| EX-1 | All REST endpoints for content types and entries return correct responses                            | e2e suite for WS-4, WS-5                     |
| EX-2 | JWT auth works with role checks on every endpoint                                                    | e2e: anonymous → 401, VIEWER → 403 on writes |
| EX-3 | Media file upload stores file and returns URL                                                        | e2e: WS-6 happy path + retrieval             |
| EX-4 | Audit log records every mutation                                                                     | e2e asserts row count after each test write  |
| EX-5 | `docker compose up` starts all services cleanly                                                      | CI step builds image + brings stack up       |
| EX-6 | `@kast/sdk` can be imported from a Node script and perform full content + media flow against the API | SDK integration test in WS-10                |
| EX-7 | All env vars validated on startup; missing var → process exit with explicit message                  | unit test on ConfigModule                    |
| EX-8 | Lint + typecheck + test + e2e green on `main` for the merge commit that closes Phase 1               | CI                                           |

---

## 7. Cross-Cutting Requirements Compliance

How Phase 1 satisfies the [PRD §5 cross-cutting](../architecture/KAST_PRD.md) rules:

| CR    | Requirement                | Phase 1 Implementation                                                              |
| ----- | -------------------------- | ----------------------------------------------------------------------------------- |
| CR-01 | TypeScript strict          | `tsconfig.base.json` + ESLint flat config (WS-1)                                    |
| CR-02 | Audit every mutation       | Global `AuditInterceptor` (WS-7)                                                    |
| CR-03 | Three-layer security       | Helmet/CORS + Throttler + JwtAuthGuard (WS-2, WS-3)                                 |
| CR-04 | BullMQ for background work | Queues registered (WS-8); Phase 1 has no >100ms ops needing it, but bus is ready    |
| CR-05 | Consistent error shape     | Global exception filter producing the spec envelope (WS-2)                          |
| CR-06 | Soft delete                | `trashedAt` honored on `ContentEntry` and `MediaFile` (WS-5, WS-6)                  |
| CR-07 | i18n ready                 | Default locale seeded; entry locale rows written; admin UI strings deferred (no UI) |
| CR-08 | RTL support                | DB direction field exists; behavior verified in Phase 2                             |
| CR-09 | Zero `console.log`         | ESLint rule + NestJS Logger (WS-2)                                                  |
| CR-10 | Env validated on startup   | Zod-based ConfigModule (WS-2)                                                       |

---

## 8. Risks & Mitigations

| Risk                                                                              | Likelihood | Impact | Mitigation                                                                                      |
| --------------------------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------- |
| Prisma schema churn forces migration rewrites                                     | Med        | Med    | Land full 38-model schema **once** in WS-2 even if unused; only additive migrations after that  |
| S3 testing requires real credentials                                              | High       | Low    | Use MinIO container in CI for `S3StorageAdapter` integration tests                              |
| `argon2id` native build fails in Alpine images                                    | Med        | Med    | Pre-build native deps in `deps` Docker stage; fall back to `node:20-bookworm-slim` if needed    |
| OpenAPI → SDK type generation breaks on edge cases (oneOf, polymorphic responses) | Med        | Low    | Phase 1 endpoints are simple; constrain schema deliberately; document any manual type overrides |
| Audit interceptor slows write throughput unacceptably                             | Low        | Med    | Inline writes are fine for Phase 1 load; toggle `AUDIT_ASYNC` to BullMQ in Phase 2              |
| Scope creep from teams wanting "just one MCP/SEO/i18n endpoint now"               | High       | High   | Phase 2 backlog exists; reject during sprint review; add to Phase 2 plan instead                |

---

## 9. Definition of Done

A workstream is **done** only when every item below is true:

- [ ] All endpoints implemented per [KAST_API_SPEC.md](../architecture/KAST_API_SPEC.md) shape.
- [ ] Permissions enforced per [KAST_SECURITY_MODEL.md](../architecture/KAST_SECURITY_MODEL.md).
- [ ] Unit tests for every service method with branching logic.
- [ ] e2e tests covering happy path + at least 2 error paths per endpoint.
- [ ] No `any`, no `@ts-ignore`, no `console.log` in production code.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` all pass locally.
- [ ] Audit interceptor verified to fire for new mutations.
- [ ] OpenAPI doc updated; SDK regenerates without errors.
- [ ] README / module-level `README.md` updated where developer-facing behavior changed.
- [ ] PR reviewed by at least one other engineer; conventional commit on merge.

---

## 10. Branching & PR Strategy

- **Phase branch:** `phase-1-engine` (this branch). All Phase 1 work merges into here.
- **Feature branches:** `feat/<workstream>-<short-desc>` (e.g. `feat/ws3-jwt-refresh-rotation`) cut from `phase-1-engine`.
- **PRs:** target `phase-1-engine`. Squash-merge with conventional commit subject.
- **Phase exit:** when all 8 exit criteria pass, open a single PR `phase-1-engine` → `develop`, then `develop` → `main`. Tag `v0.1.0-alpha` on `main`.
- **Hotfixes during Phase 1:** branch from `main`, merge back to `main` and rebase `phase-1-engine` to keep history linear.

---

_Plan owner: @kast-cms maintainers · Last updated: 2026-04-24_

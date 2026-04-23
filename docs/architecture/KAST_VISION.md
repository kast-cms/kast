# KAST CMS

### _Cast Your Content Everywhere_

> **Open-source. AI-native. Developer-first. Easy for everyone.**

---

## Table of Contents

1. [What Is Kast?](#1-what-is-kast)
2. [The Problem We Solve](#2-the-problem-we-solve)
3. [Positioning](#3-positioning)
4. [Core Philosophy](#4-core-philosophy)
5. [Tech Stack](#5-tech-stack)
6. [Architecture Overview](#6-architecture-overview)
7. [The Kast Ecosystem](#7-the-kast-ecosystem)
8. [Feature Map](#8-feature-map)
9. [Module Breakdown](#9-module-breakdown)
10. [Plugin System](#10-plugin-system)
11. [AI & MCP Integration](#11-ai--mcp-integration)
12. [Packaging Strategy](#12-packaging-strategy)
13. [Phased Roadmap](#13-phased-roadmap)
14. [Monorepo Structure](#14-monorepo-structure)
15. [Open Source Strategy](#15-open-source-strategy)
16. [What We Are Not](#16-what-we-are-not)

---

## 1. What Is Kast?

**Kast** is a modern, open-source, AI-native Content Management System built for developers who need full control — and for editors who need simplicity.

It is **headless-first**, meaning it serves content via REST and GraphQL APIs to any frontend. But it also ships an official Next.js frontend for teams who want a full-stack, out-of-the-box experience.

Kast is:

- As **easy to set up** as WordPress
- As **secure and structured** as Strapi
- As **SEO-powerful** as any dedicated SEO platform
- As **AI-native** as Cloudflare's EmDash
- **RTL and i18n ready** from day one

---

## 2. The Problem We Solve

| Problem                               | Current Reality                                | Kast's Answer                                           |
| ------------------------------------- | ---------------------------------------------- | ------------------------------------------------------- |
| SEO is an afterthought                | Most CMSs bolt on SEO via plugins              | SEO is a core module, not optional                      |
| AI agents can't control CMSs reliably | No standard interface for AI to manage CMS     | Built-in MCP server from day one                        |
| Setup is too complex                  | Strapi, Payload require deep Node.js knowledge | `npx create-kast-app` — done in minutes                 |
| RTL/Arabic support is broken          | Most CMSs treat RTL as an edge case            | First-class RTL, Arabic, multilingual support           |
| Plugins are unsafe                    | Bad plugins crash the whole system             | Sandboxed plugin execution                              |
| Observability is missing              | Most CMSs have no audit trail                  | Structured logs, audit history, error tracking built-in |

---

## 3. Positioning

Kast sits at the intersection of three things no single CMS does well simultaneously:

```
           EASY (WordPress)
                 ^
                 |
                 |
                 |
    ─────────────●─────────────>  AI-NATIVE (EmDash)
                 |
                 |
                 |
           SECURE + SEO (Strapi / Yoast)
```

**Kast occupies the center.**

### Who Is It For?

**Primary:** Full-stack developers building content-driven products

- SaaS marketing sites
- E-commerce stores
- Multi-language corporate websites
- Documentation platforms
- News and media platforms

**Secondary:** Development agencies needing a white-label CMS they can extend

**Tertiary:** Non-technical editors who use the admin UI daily

---

## 4. Core Philosophy

### 1. SEO is infrastructure, not a feature

Sitemaps, redirects, meta, structured data, canonical URLs — these are not plugins. They are core.

### 2. AI agents are first-class users

Every operation available to a human developer must be available to an AI agent via MCP. Agents need their own RBAC scope, audit trail, and dry-run preview.

### 3. Security by default, not by configuration

Secure HTTP headers, CORS, CSRF, rate limiting, RBAC, field-level permissions, and plugin sandboxing — all enabled by default, with zero configuration.

### 4. Code is the source of truth

Schemas live in TypeScript files, not only in a database. This means version control, code review, and full type safety across the stack.

### 5. Developer experience is a product

Type-safe everything. Generated SDK. Hot reload in dev. A CLI that does the boring work. Docs that actually answer real questions.

### 6. Ecosystems beat monoliths

A small, high-quality plugin system is better than trying to build everything. Kast ships 5 first-party plugins and provides a clean, sandboxed SDK for the community.

---

## 5. Tech Stack

| Layer                       | Technology                             | Why                                                                                                                             |
| --------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Backend**                 | NestJS (Node.js + TypeScript)          | Modules = natural plugin system. Guards = RBAC. Interceptors = logging/audit                                                    |
| **Admin Panel**             | Next.js 15 (App Router)                | Server Components = fastest admin UI. TypeScript-native                                                                         |
| **Frontend Starter**        | Next.js 15                             | Same tech, shared components, first-class integration                                                                           |
| **Database**                | PostgreSQL (v1)                        | Production-grade. JSONB for flexible content. Full-text search built-in                                                         |
| **ORM**                     | Prisma                                 | Type-safe schema, auto-migrations, great DX                                                                                     |
| **Auth**                    | Custom NestJS AuthModule + JWT + OAuth | Full control, no magic                                                                                                          |
| **API**                     | REST + GraphQL (NestJS built-in)       | Covers 100% of use cases                                                                                                        |
| **Media Storage**           | Local FS + S3-compatible abstraction   | Works anywhere                                                                                                                  |
| **Job Queue**               | BullMQ (`@nestjs/bullmq`)              | Redis-backed background jobs: webhooks, media processing, SEO validation, scheduled publishing — all built-in, no extra service |
| **Internal Events**         | NestJS EventEmitter                    | Zero-dependency pub/sub between modules                                                                                         |
| **Caching + Queue Backend** | Redis (required)                       | Powers both API response cache and BullMQ queues — one service, two jobs                                                        |
| **Search**                  | Meilisearch (optional plugin)          | Fast, open-source, Arabic-aware                                                                                                 |
| **Error Tracking**          | Sentry adapter (built-in)              | Via OpenTelemetry adapter                                                                                                       |
| **Package Manager**         | pnpm + Turborepo                       | Fast monorepo, shared dependencies                                                                                              |
| **CLI**                     | Custom Node.js CLI                     | `npx create-kast-app`                                                                                                           |
| **Containerization**        | Docker + Docker Compose                | Self-hosted by default                                                                                                          |

---

## 6. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         KAST CMS                                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    NestJS API Server                    │   │
│  │                                                         │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ Content  │ │   SEO    │ │   Auth   │ │  Media   │  │   │
│  │  │ Module   │ │  Module  │ │  Module  │ │  Module  │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │  Plugin  │ │   MCP    │ │  Audit   │ │ Webhook  │  │   │
│  │  │  Module  │ │  Module  │ │  Module  │ │  Module  │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  │  ┌──────────┐ ┌──────────┐                             │   │
│  │  │   i18n   │ │Commerce  │                             │   │
│  │  │  Module  │ │  Module  │  (v2)                       │   │
│  │  └──────────┘ └──────────┘                             │   │
│  └────────────────────────┬────────────────────────────── ┘   │
│                           │                                     │
│            ┌──────────────┼──────────────┐                     │
│            │              │              │                      │
│     ┌──────▼──────┐ ┌────▼────┐ ┌──────▼──────┐              │
│     │  REST API   │ │GraphQL  │ │  MCP Server │              │
│     │  /api/v1    │ │/graphql │ │  /mcp       │              │
│     └─────────────┘ └─────────┘ └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
         │                              │
         │                              │
┌────────▼────────┐            ┌────────▼─────────────────┐
│  Next.js Admin  │            │  AI Agents                │
│  Panel          │            │  (Claude, Cursor, etc.)   │
│  /admin         │            └──────────────────────────-┘
└─────────────────┘
         │
┌────────▼────────┐
│ Next.js Frontend│
│ Starter (opt.)  │
│ /               │
└─────────────────┘
```

### Data Flow

```
Editor → Admin UI → NestJS API → PostgreSQL (via Prisma)
                         │
                         ↓
               NestJS EventEmitter (internal bus)
                         │
              ┌──────────┼────────────┐
              ↓          ↓            ↓
         BullMQ       BullMQ       BullMQ
         Webhook      Media        SEO
         Queue        Queue        Queue
              │          │            │
              ↓          ↓            ↓
         HTTP POST    Sharp.js    SEO MCP
         + HMAC sig   + WebP      Validation
         + Retry      + Resize    (built-in)


AI Agent → MCP Server → NestJS API → PostgreSQL
                              ↓
                    BullMQ Audit Queue
                              ↓
                    AuditModule (agent-tagged)
```

---

## 7. The Kast Ecosystem

Kast is not a standalone tool. It is the **center of a connected ecosystem** — with a self-contained core and clean integration points for the outside world.

```
                        ┌─────────────────────────────┐
                        │          KAST CMS            │
                        │                             │
                        │  ┌────────┐  ┌───────────┐  │
                        │  │BullMQ  │  │ EventEmit │  │
                        │  │Queues  │  │ (internal)│  │
                        │  └───┬────┘  └─────┬─────┘  │
                        └──────┼─────────────┼────────┘
                               │             │
              ┌────────────────┼─────────────┼────────────────┐
              │                │             │                │
     ┌────────▼───────┐  ┌─────▼──────┐  ┌──▼───────────┐  ┌▼──────────────┐
     │  Outbound       │  │  Media     │  │  SEO MCP     │  │  Kast MCP     │
     │  Webhooks       │  │  Processing│  │  Validation  │  │  Server       │
     │  (HTTP + HMAC)  │  │  (Sharp)   │  │  (built-in)  │  │  (AI Control) │
     └────────┬────────┘  └────────────┘  └──────────────┘  └──┬────────────┘
              │                                                  │
     ┌────────▼────────┐                                ┌───────▼──────┐
     │  Any External   │                                │ Claude/Cursor│
     │  Service:       │                                │ Any MCP      │
     │  n8n, Zapier,   │                                │ Compatible   │
     │  Make, Lambda   │                                │ AI Agent     │
     └─────────────────┘                                └──────────────┘
```

### 7.1 Built-in Job Queue (BullMQ)

Every background operation in Kast runs through **BullMQ** — a Redis-backed job queue built into the NestJS core. No external automation service required.

| Queue          | What It Handles                                       |
| -------------- | ----------------------------------------------------- |
| `kast.webhook` | Outbound webhook delivery with retry + HMAC signing   |
| `kast.media`   | Image resizing, WebP conversion, alt-text generation  |
| `kast.seo`     | SEO validation on content save, score tracking        |
| `kast.publish` | Scheduled content publishing (delayed jobs)           |
| `kast.audit`   | Async audit log writes for high-throughput operations |
| `kast.email`   | Transactional emails via pluggable adapter            |

This means a Kast installation that does all of the above runs on **four services only:**

```yaml
services:
  api: # NestJS — the whole CMS engine
  admin: # Next.js admin panel
  postgres: # Primary database
  redis: # Cache + all BullMQ queues
```

### 7.2 Outbound Webhooks (External Integrations)

Kast fires signed HTTP webhooks on every content lifecycle event. What you do with those webhooks is up to you — connect anything:

| Kast Event          | You Can Connect                      |
| ------------------- | ------------------------------------ |
| `content.published` | n8n, Zapier, Make, custom Lambda     |
| `media.uploaded`    | Image CDN, AI processing pipeline    |
| `seo.score_changed` | Alerting system, Slack bot           |
| `form.submitted`    | CRM, email marketing, custom backend |
| `user.created`      | Onboarding workflows                 |

Every webhook is **HMAC-signed**, has delivery logs, and retries automatically via BullMQ. External tools receive a standard signed HTTP POST — they need no special Kast knowledge.

### 7.3 Kast MCP Server (AI Agent Control)

Every Kast installation ships with a built-in MCP server. Connect it to Claude, Cursor, or any MCP-compatible AI agent:

```typescript
// Tools exposed by Kast MCP Server
kast_content_list({ type, status, limit, filters });
kast_content_create({ type, data, locale });
kast_content_update({ id, data });
kast_content_publish({ id });
kast_content_unpublish({ id });
kast_schema_create_type({ name, fields });
kast_schema_add_field({ contentType, field });
kast_seo_validate({ entryId });
kast_plugin_install({ name, version });
kast_plugin_enable({ name });
kast_plugin_disable({ name });
kast_media_upload({ url, folder });
kast_redirect_create({ from, to, type });
kast_user_create({ email, role });
kast_audit_log({ limit, filters });
```

Any developer who installs Kast gets full AI control of their CMS out of the box — no extra configuration.

### 7.4 SEO MCP Integration (Built-in Validation)

Kast's SEO module can connect to any MCP-compatible SEO validation server to run live audits during the editorial flow:

```
Editor saves content
       ↓
Kast SEO Module triggers BullMQ SEO queue
       ↓
SEO MCP Server called (pluggable endpoint)
       ↓
Score + issues returned
       ↓
Live SEO panel shown in admin UI (before publish)
       ↓
Editor fixes issues → publishes clean content
```

This makes Kast the **only CMS with a live, MCP-powered SEO validation panel built natively into the editorial flow**.

```typescript
// SeoValidationService inside SeoModule
@Injectable()
export class SeoValidationService {
  async validateEntry(entry: ContentEntry): Promise<SeoReport> {
    return this.seoMcpClient.call('full_seo_audit', {
      url: entry.previewUrl,
    });
  }
}
```

The SEO MCP endpoint is configurable — point it at any compatible server.

---

## 8. Feature Map

### v1 Beta (3–6 months)

| Feature                                       | Status  |
| --------------------------------------------- | ------- |
| Content types + custom fields                 | ✅ Core |
| REST API (auto-generated)                     | ✅ Core |
| GraphQL API                                   | ✅ Core |
| Next.js Admin Panel                           | ✅ Core |
| Auth + RBAC (admin users)                     | ✅ Core |
| **SEO Module (built-in, not plugin)**         | ✅ Core |
| **SEO MCP integration (live validation)**     | ✅ Core |
| **Kast MCP Server**                           | ✅ Core |
| **i18n + RTL (Arabic first-class)**           | ✅ Core |
| Draft / Publish workflow                      | ✅ Core |
| Version history + revert                      | ✅ Core |
| Media (local + S3-compatible)                 | ✅ Core |
| Structured audit logs                         | ✅ Core |
| Webhooks (outbound, HMAC-signed)              | ✅ Core |
| **BullMQ job queues (background processing)** | ✅ Core |
| Sentry / OpenTelemetry adapter                | ✅ Core |
| `npx create-kast-app` CLI                     | ✅ Core |
| Docker image + Compose                        | ✅ Core |
| PostgreSQL (Prisma ORM)                       | ✅ Core |
| TypeScript SDK (`@kast/sdk`)                  | ✅ Core |
| Plugin system v1 (basic)                      | ✅ Core |

### v2 (6–12 months)

| Feature                                      | Status |
| -------------------------------------------- | ------ |
| Full plugin marketplace                      | 🔜 v2  |
| GraphQL subscriptions (real-time)            | 🔜 v2  |
| Commerce module (products, orders, payments) | 🔜 v2  |
| Stripe + PayPal adapters                     | 🔜 v2  |
| Page builder / block editor                  | 🔜 v2  |
| Scheduled publishing                         | 🔜 v2  |
| AI content drafting (built into admin)       | 🔜 v2  |
| AI image alt-text generation                 | 🔜 v2  |
| SQLite support (dev only)                    | 🔜 v2  |
| Visual content modeling UI                   | 🔜 v2  |
| Team collaboration + comments                | 🔜 v2  |

### v3 (12+ months)

| Feature                                    | Status |
| ------------------------------------------ | ------ |
| Multi-tenant mode                          | 🔜 v3  |
| SaaS cloud offering                        | 🔜 v3  |
| Managed plugin registry (signed, reviewed) | 🔜 v3  |
| Serverless / Cloudflare Workers profile    | 🔜 v3  |
| White-label / agency mode                  | 🔜 v3  |

---

## 9. Module Breakdown

### ContentModule

- Content type definitions (TypeScript-first, stored as config files)
- Field types: text, rich text, number, boolean, date, media, relation, JSON, component, block
- Relations: one-to-one, one-to-many, many-to-many
- Draft ↔ Published state machine
- Version history with diff and revert
- Bulk operations (publish many, delete many)

### SeoModule _(core, not a plugin)_

- Per-entry: slug, meta title, meta description, OG image, OG title, Twitter card
- Auto-generated XML sitemap (with i18n support)
- Redirect manager (301/302) with bulk import/export
- Canonical URL management
- JSON-LD structured data components
- **Live SEO validation panel** (powered by SEO MCP Server)
- SEO score stored per entry, historical tracking

### AuthModule

- Admin users: email/password, JWT refresh tokens
- OAuth providers: Google, GitHub (pluggable)
- RBAC: roles (Super Admin, Admin, Editor, Viewer) + custom roles
- Field-level permissions (per content type, per field, per role)
- API token management (read-only, full-access, scoped tokens)
- Agent RBAC: separate scope for MCP/AI agent tokens

### MediaModule

- Upload: single, multi, from URL
- Storage adapters: local filesystem, S3, R2, GCS (pluggable)
- Image processing: resize, crop, WebP conversion (Sharp)
- Alt text: manual + AI-suggested (v2)
- Folder organization
- Usage tracking (which entries use this media)

### MCPModule _(core, not a plugin)_

- Built-in MCP server at `/mcp`
- All admin operations exposed as MCP tools
- Agent-scoped RBAC tokens
- Dry-run / preview mode for destructive operations
- Audit log tagging for agent actions
- Agent Skills metadata (machine-readable operation docs)

### I18nModule

- Per-field localization
- Language fallback chain
- RTL/LTR per-locale (Arabic, Hebrew, etc.)
- Admin UI direction switching
- Language-aware URL slugs
- Sitemap with hreflang

### AuditModule

- Immutable audit log for all content edits, schema changes, auth events
- Agent-tagged entries (which AI tool made this change)
- Query + filter (by user, by content type, by date range, by agent)
- Export (JSON, CSV)
- Retention policy configuration

### WebhookModule

- Outbound webhooks on all content lifecycle events
- Delivery via BullMQ queue with retry + exponential backoff
- Delivery logs and failure alerts
- Secret signing (HMAC) on every request
- Standard HTTP POST — compatible with any external service (n8n, Zapier, Make, Lambda, custom)

### QueueModule _(core, not a plugin)_

- BullMQ integration via `@nestjs/bullmq`
- Named queues: `webhook`, `media`, `seo`, `publish`, `audit`, `email`
- Bull Board admin UI panel (queue monitoring built into /admin)
- Dead-letter queue for failed jobs
- Job priorities, delays, and rate limiting per queue
- Redis connection shared with caching layer — no extra service

### PluginModule

- NestJS Dynamic Module pattern for plugin loading
- Plugin manifest: `kast.plugin.ts` (name, version, permissions, hooks)
- Hook system: `beforeCreate`, `afterPublish`, `onMediaUpload`, etc.
- Sandboxed execution (separate process / Worker isolation in v2)
- Admin UI extension points: panels, menu items, dashboard widgets

---

## 10. Plugin System

### Plugin Types

| Type                     | Examples                                         |
| ------------------------ | ------------------------------------------------ |
| **Field plugins**        | Custom rich text editor, color picker, map field |
| **Auth providers**       | LDAP, SAML, custom OAuth                         |
| **Storage providers**    | Cloudflare R2, GCS, Azure Blob                   |
| **Payment adapters**     | Stripe, PayPal, regional gateways                |
| **Search adapters**      | Meilisearch, Algolia, Elasticsearch              |
| **Notification plugins** | Resend, SendGrid, Twilio                         |
| **Workflow plugins**     | Approval chains, custom publish rules            |
| **AI skills**            | Custom content generators, translation engines   |
| **Frontend blocks**      | Custom page builder blocks                       |

### First-Party Plugins (v1)

- `@kast/plugin-stripe` — Stripe payments adapter
- `@kast/plugin-meilisearch` — Full-text search
- `@kast/plugin-resend` — Transactional email
- `@kast/plugin-cloudflare-r2` — R2 media storage
- `@kast/plugin-sentry` — Error tracking adapter

### Plugin Manifest Example

```typescript
// kast.plugin.ts
export default definePlugin({
  name: 'stripe',
  version: '1.0.0',
  compatibleWith: '^1.0.0',
  permissions: {
    content: ['read'],
    webhooks: ['create'],
    admin: ['panel:payments'],
  },
  hooks: {
    afterOrderCreate: async (order, context) => {
      // create Stripe payment intent
    },
  },
  adminPanels: [{ id: 'payments', label: 'Payments', component: './panels/PaymentsPanel' }],
});
```

---

## 11. AI & MCP Integration

### The Kast MCP Server

Every Kast installation ships with a built-in MCP server. Connect it to Claude, Cursor, or any MCP-compatible AI:

```
Claude.ai → Kast MCP Server → Full CMS Control
```

### Agent Safety Architecture

```
Agent Request
     ↓
[Token Scope Check] → reject if out of scope
     ↓
[Dry-run Mode] → preview changes before applying
     ↓
[Apply Changes]
     ↓
[Audit Log] → agent_id, tool_name, timestamp, diff
```

### AI Features Roadmap

| Feature                                        | Version |
| ---------------------------------------------- | ------- |
| MCP server (read + write CMS)                  | v1      |
| Agent RBAC tokens                              | v1      |
| Dry-run preview for agent actions              | v1      |
| Audit trail with agent attribution             | v1      |
| AI SEO suggestions via SEO MCP                 | v1      |
| AI content drafting in admin                   | v2      |
| AI image alt-text generation                   | v2      |
| AI migration assistant (from WordPress, Ghost) | v2      |
| AI schema designer                             | v2      |

---

## 12. Packaging Strategy

### The Hybrid Approach

Kast ships as **both** npm packages and a scaffolded application.

#### npm Packages (`@kast/*`)

```
@kast/core          → NestJS CMS engine (the brain)
@kast/admin         → Next.js admin panel
@kast/sdk           → TypeScript client SDK (for frontends)
@kast/plugin-sdk    → Interface for building plugins
@kast/cli           → The create-kast-app CLI
@kast/ui            → Shared component library
```

Developers who want to embed Kast inside an existing Node app:

```typescript
import { KastModule } from '@kast/core';

@Module({
  imports: [KastModule.forRoot(config)],
})
export class AppModule {}
```

#### Scaffolded App (`create-kast-app`)

For everyone else:

```bash
npx create-kast-app my-site

# Interactive setup:
? Project name: my-site
? Database: PostgreSQL
? Admin port: 3001
? Enable i18n? Yes
? Default languages: English, Arabic
? Storage: Local (can change later)
? Install plugins: Meilisearch, Sentry

✓ Project created
✓ Database configured
✓ Docker Compose ready

Run: cd my-site && docker-compose up
Admin: http://localhost:3001/admin
API:   http://localhost:3001/api
MCP:   http://localhost:3001/mcp
```

This is Kast's **"easy like WordPress"** moment.

---

## 13. Phased Roadmap

### Phase 1 — The Engine (Month 1–2)

**Goal:** Working headless CMS, API-only, developer-focused

- [ ] Monorepo setup (pnpm + Turborepo)
- [ ] NestJS core with module architecture
- [ ] Prisma + PostgreSQL integration
- [ ] Content type definitions (TypeScript-first)
- [ ] REST API auto-generated from schemas
- [ ] Basic auth (email/password + JWT)
- [ ] Basic RBAC (admin roles)
- [ ] Media upload (local + S3)
- [ ] Structured logging + audit log foundation
- [ ] Docker image + Compose file
- [ ] `@kast/sdk` TypeScript client v0.1

### Phase 2 — The Differentiators (Month 2–4)

**Goal:** Everything that makes Kast unique vs Strapi/Payload

- [ ] Next.js Admin Panel (content modeling + editorial)
- [ ] **SEO Module** (slugs, meta, sitemap, redirects, JSON-LD)
- [ ] **SEO MCP Server integration** (live admin SEO panel)
- [ ] **Kast MCP Server** (full CMS control via MCP)
- [ ] **i18n Module** (per-field, RTL, language fallbacks)
- [ ] GraphQL API layer
- [ ] Draft/Publish workflow + version history
- [ ] **BullMQ queue system** (webhook delivery, media processing, scheduled jobs)
- [ ] Webhook system (outbound, HMAC-signed, delivery logs)
- [ ] Plugin system v1 (NestJS dynamic modules)
- [ ] Agent RBAC tokens + audit attribution

### Phase 3 — The Polish (Month 4–6)

**Goal:** Ready for public beta with real users

- [ ] `npx create-kast-app` CLI with interactive setup
- [ ] Next.js frontend starter (blog + e-commerce templates)
- [ ] First-party plugins: Stripe, Meilisearch, Resend, R2, Sentry
- [ ] Integration docs: n8n, Zapier, Make webhook guides
- [ ] Full documentation site
- [ ] One-click deploy: Railway, Vercel, Render buttons
- [ ] Security hardening (CSP, HSTS, rate limiting, CORS)
- [ ] Public beta launch on GitHub

---

## 14. Monorepo Structure

```
kast/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── content/
│   │   │   │   ├── seo/
│   │   │   │   ├── auth/
│   │   │   │   ├── media/
│   │   │   │   ├── mcp/
│   │   │   │   ├── i18n/
│   │   │   │   ├── audit/
│   │   │   │   ├── webhook/
│   │   │   │   └── plugin/
│   │   │   ├── prisma/
│   │   │   │   └── schema.prisma
│   │   │   └── main.ts
│   │   └── package.json
│   │
│   ├── admin/                  # Next.js admin panel
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── content/
│   │   │   │   ├── media/
│   │   │   │   ├── seo/
│   │   │   │   ├── plugins/
│   │   │   │   └── settings/
│   │   │   └── layout.tsx
│   │   └── package.json
│   │
│   ├── web-starter/            # Next.js frontend starter
│   │   └── ...
│   │
│   └── cli/                    # create-kast-app CLI
│       └── ...
│
├── packages/
│   ├── core/                   # @kast/core — shared types + interfaces
│   ├── sdk/                    # @kast/sdk — TypeScript client
│   ├── plugin-sdk/             # @kast/plugin-sdk — plugin building interface
│   └── ui/                     # @kast/ui — shared component library
│
├── plugins/                    # First-party plugins
│   ├── stripe/                 # @kast/plugin-stripe
│   ├── meilisearch/            # @kast/plugin-meilisearch
│   ├── resend/                 # @kast/plugin-resend
│   ├── cloudflare-r2/          # @kast/plugin-cloudflare-r2
│   └── sentry/                 # @kast/plugin-sentry
│
├── docs/                       # Documentation site
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── README.md
```

---

## 15. Open Source Strategy

### License

**MIT License** — maximum adoption, zero friction, developers trust it.

### GitHub Strategy

- **Organization:** `github.com/kast-cms`
- **Main repo:** `kast-cms/kast` (monorepo)
- **Website:** `kastcms.com` or `kast.dev`
- **npm scope:** `@kast`

### Community Building

1. **Phase 1:** Solo development, internal testing on real projects
2. **Phase 2:** Public beta, accept issues + PRs, Discord server
3. **Phase 3:** Plugin SDK docs published, invite community contributors
4. **Phase 4:** Plugin marketplace, official partner integrations

### Sustainability (Future)

| Model                  | Description                               |
| ---------------------- | ----------------------------------------- |
| **Kast Cloud**         | Managed hosting (like Strapi Cloud)       |
| **Enterprise License** | Multi-tenant, SSO, SLA, priority support  |
| **Agency Partners**    | Certified agencies using Kast for clients |
| **Plugin Marketplace** | Revenue share on premium plugins          |

---

## 16. What We Are Not

To stay focused and ship on time, Kast deliberately excludes:

- Not a website builder (like Wix or Squarespace) — Kast is developer-first
- Not a blogging platform (like Ghost) — Kast is a content platform that _can_ power blogs
- Not a multi-database system in v1 — PostgreSQL only, done right
- Not a monolith with everything built-in — plugins handle non-core features
- Not a cloud-only product — self-hosted is the default
- Not a visual drag-and-drop page builder in v1 — that is v2

---

## Summary Card

```
Name:        Kast CMS
Tagline:     Cast Your Content Everywhere
License:     MIT (Open Source)
Stack:       NestJS + Next.js + PostgreSQL + Prisma + BullMQ
Mode:        Headless-first + Optional Full-Stack Frontend
CLI:         npx create-kast-app
npm:         @kast/core, @kast/admin, @kast/sdk, @kast/plugin-sdk
Unique:      SEO-native + MCP/AI-native + RTL-first + Secure-by-default
Queue:       BullMQ (webhooks, media, SEO, publishing — all built-in)
Ecosystem:   MCP server + outbound webhooks + SEO validation + AI agents
Timeline:    3-6 months to public beta
GitHub:      github.com/kast-cms
```

---

_Document version: 0.1_
_Last updated: April 2026_
_Author: Oday Bakkour_
_Status: Vision and Planning Phase_

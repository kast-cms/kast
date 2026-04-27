# KAST CMS — Product Requirements Document

### _What it does. Who does it. How it behaves. What success looks like._

> PRD Version: 1.0 | April 2026 | Status: Draft
> Covers: v1 (detailed) + v2/v3 (future considerations)
> References: KAST_VISION.md · KAST_DATABASE_SCHEMA.md · KAST_API_SPEC.md · KAST_SECURITY_MODEL.md · KAST_DEV_STANDARDS.md

---

## Table of Contents

**Part 1 — Foundation**

1. [Document Overview](#1-document-overview)
2. [Product Summary](#2-product-summary)
3. [Personas](#3-personas)
4. [Phased Delivery Plan](#4-phased-delivery-plan)
5. [Cross-Cutting Requirements](#5-cross-cutting-requirements)

**Part 2 — Module Requirements** 6. [Installation and CLI](#6-installation-and-cli) 7. [Authentication Module](#7-authentication-module) 8. [Content Types Module](#8-content-types-module) 9. [Content Entries Module](#9-content-entries-module) 10. [SEO Module](#10-seo-module) 11. [Media Module](#11-media-module) 12. [i18n and Locales Module](#12-i18n-and-locales-module) 13. [Users and Roles Module](#13-users-and-roles-module) 14. [Webhooks Module](#14-webhooks-module) 15. [Plugins Module](#15-plugins-module) 16. [Forms Module](#16-forms-module) 17. [Menus and Navigation Module](#17-menus-and-navigation-module) 18. [Global Settings Module](#18-global-settings-module) 19. [Audit Log Module](#19-audit-log-module) 20. [Trash and Recovery Module](#20-trash-and-recovery-module) 21. [MCP Server and AI Agents Module](#21-mcp-server-and-ai-agents-module) 22. [Queue System — BullMQ](#22-queue-system--bullmq) 23. [Health and Monitoring](#23-health-and-monitoring)

**Part 3 — Standards** 24. [Performance Requirements](#24-performance-requirements) 25. [Accessibility Requirements](#25-accessibility-requirements) 26. [Future Considerations v2 and v3](#26-future-considerations-v2-and-v3) 27. [Success Metrics](#27-success-metrics)

---

## 1. Document Overview

### Purpose

This PRD defines the complete product requirements for Kast CMS v1. It is the single source of truth for what gets built, why it exists, how it behaves, who can do what, and what done looks like.

Every requirement in this document is traceable to:

- A database model in KAST_DATABASE_SCHEMA.md
- An API endpoint in KAST_API_SPEC.md
- A permission in KAST_SECURITY_MODEL.md
- A code standard in KAST_DEV_STANDARDS.md

### How to Read This Document

Each module section follows this structure:

- Overview: what the module is and why it exists
- Business Requirements: what it must do (BR-XXX-001)
- User Stories: who needs it and why (US-XXX-001)
- Acceptance Criteria: how to verify it works (AC-XXX-001)
- Admin UI: detailed screen-by-screen description
- Error States: every failure scenario documented
- Performance: specific targets for this module

### Requirement IDs

| Prefix | Type                    | Example    |
| ------ | ----------------------- | ---------- |
| BR     | Business Requirement    | BR-CON-001 |
| US     | User Story              | US-CON-001 |
| AC     | Acceptance Criteria     | AC-CON-001 |
| ER     | Error State             | ER-CON-001 |
| PF     | Performance Requirement | PF-CON-001 |

Module codes: INS (Install), AUT (Auth), SCH (Schema), CON (Content), SEO, MED (Media), I18 (i18n), USR (Users), WHK (Webhooks), PLG (Plugins), FRM (Forms), MNU (Menus), SET (Settings), AUD (Audit), TRS (Trash), MCP, QUE (Queue), HLT (Health)

---

## 2. Product Summary

### What Is Kast?

Kast is an open-source, AI-native, headless-first Content Management System. It is built for full-stack developers who need complete control over their CMS, and for non-technical editors who need a clean, intuitive interface.

### The Four Differentiators

| Differentiator           | What It Means                                                      |
| ------------------------ | ------------------------------------------------------------------ |
| SEO is core              | Sitemaps, redirects, meta, structured data — built-in, not plugins |
| AI-native from day one   | Every CMS operation available to AI agents via built-in MCP server |
| Easiest setup            | npx create-kast-app — running in under 5 minutes                   |
| RTL and i18n first-class | Arabic, Hebrew, and all RTL languages are not an afterthought      |

### v1 Scope Summary

In scope:

- Monorepo: NestJS API + Next.js Admin + CLI + TypeScript SDK
- 18 functional modules
- PostgreSQL + Redis + BullMQ
- 107 REST API endpoints
- 38 database models
- 4 system roles + custom roles
- MCP server with 15 tools
- Docker Compose deployment

Out of scope for v1:

- GraphQL subscriptions
- Commerce module
- Page builder
- Multi-tenant mode
- SQLite support
- AI content drafting UI (schema exists, UI ships v2)
- Plugin marketplace

---

## 3. Personas

### P1 — The Developer (Primary)

**Goal:** Install a CMS that gives full TypeScript control, clean APIs, and doesn't fight them

**Frustrations:** Strapi is heavy. Payload has a learning curve. WordPress is PHP.

**Needs from Kast:**

- npx create-kast-app that works first try
- Type-safe SDK with generated types
- NestJS module they can extend or embed
- MCP server they can connect to Claude or Cursor
- Clean monorepo they can read and contribute to

**Technical level:** Expert. Reads source code. Files issues.

---

### P2 — The Editor (Tertiary)

**Goal:** Write, publish, and manage content without asking a developer

**Frustrations:** WordPress feels outdated. Strapi admin is confusing. Contentful is expensive.

**Needs from Kast:**

- A clean, fast admin panel
- A live SEO score they can understand and act on
- Simple draft to publish flow
- No broken RTL text when writing Arabic

**Technical level:** None. Uses the admin UI only.

---

### P3 — The Agency Developer (Secondary)

**Goal:** A white-label CMS to deploy for clients and extend with custom plugins

**Frustrations:** WordPress plugins are unsafe. Strapi cloud is expensive. Custom builds take too long.

**Needs from Kast:**

- Plugin SDK to build custom field types and integrations
- Role-based access so clients cannot break things
- Docker image that deploys to any VPS
- Webhook system that connects to any client's existing tools

**Technical level:** Intermediate-Advanced.

---

### P4 — The AI Agent (Emerging)

**Goal:** Manage CMS content, schema, and settings on behalf of a human developer

**Needs from Kast:**

- MCP server with complete, well-documented tools
- Dry-run mode to preview before applying changes
- Scoped tokens that limit what it can do
- Audit trail showing exactly what it did

**Technical level:** N/A — interacts via MCP protocol only.

---

## 4. Phased Delivery Plan

### Phase 1 — The Engine (Month 1-2)

Goal: Working headless CMS. No admin UI yet. Developers integrate via API.

| ID     | Deliverable                        | Module  |
| ------ | ---------------------------------- | ------- |
| PH1-01 | Monorepo setup + CI pipeline       | All     |
| PH1-02 | NestJS core + Prisma + PostgreSQL  | All     |
| PH1-03 | Content types API (CRUD)           | Schema  |
| PH1-04 | Content entries API (CRUD)         | Content |
| PH1-05 | Auth (email/password + JWT + RBAC) | Auth    |
| PH1-06 | Media upload (local + S3)          | Media   |
| PH1-07 | Audit log foundation               | Audit   |
| PH1-08 | Docker image + Compose             | Install |
| PH1-09 | @kast/sdk TypeScript client v0.1   | SDK     |
| PH1-10 | BullMQ + Redis integration         | Queue   |

Phase 1 Exit Criteria:

- All REST endpoints for content types and entries return correct responses
- JWT auth works with role checks on every endpoint
- Media file upload stores file and returns URL
- Audit log records every mutation
- docker-compose up starts all services cleanly

---

### Phase 2 — The Differentiators (Month 2-4)

Goal: Everything that makes Kast unique. Admin UI ships here.

| ID     | Deliverable                               | Module   |
| ------ | ----------------------------------------- | -------- |
| PH2-01 | Next.js admin panel — content modeling UI | Schema   |
| PH2-02 | Next.js admin panel — editorial UI        | Content  |
| PH2-03 | SEO module + live MCP validation panel    | SEO      |
| PH2-04 | MCP server — 15 tools                     | MCP      |
| PH2-05 | i18n module + RTL admin UI                | i18n     |
| PH2-06 | Draft/Publish/Schedule workflow           | Content  |
| PH2-07 | Version history + revert                  | Content  |
| PH2-08 | BullMQ queues (all 6 operational)         | Queue    |
| PH2-09 | Webhook system (outbound, HMAC, retry)    | Webhooks |
| PH2-10 | Plugin system v1                          | Plugins  |
| PH2-11 | Agent tokens + MCP RBAC                   | MCP      |
| PH2-12 | Forms module                              | Forms    |
| PH2-13 | Menus module                              | Menus    |
| PH2-14 | Trash + 30-day recovery                   | Trash    |

Phase 2 Exit Criteria:

- Admin panel works end-to-end for creating types, entries, and publishing
- SEO score appears before publish
- MCP server responds to all 15 tools from Claude.ai
- RTL content types display correctly in Arabic
- Webhooks deliver with HMAC signature
- Trashed items recoverable within 30 days

---

### Phase 3 — The Polish (Month 4-6)

Goal: Production-ready public beta.

| ID     | Deliverable                                                  | Module   |
| ------ | ------------------------------------------------------------ | -------- |
| PH3-01 | npx create-kast-app CLI                                      | Install  |
| PH3-02 | Next.js frontend starter (blog + docs templates)             | All      |
| PH3-03 | First-party plugins: Stripe, Meilisearch, Resend, R2, Sentry | Plugins  |
| PH3-04 | Global Settings UI                                           | Settings |
| PH3-05 | Audit log UI                                                 | Audit    |
| PH3-06 | Full security hardening                                      | Security |
| PH3-07 | One-click deploy: Railway + Render + Vercel                  | Install  |
| PH3-08 | Full documentation site                                      | Docs     |
| PH3-09 | Public beta launch on GitHub                                 | All      |
| PH3-10 | OAuth (Google + GitHub)                                      | Auth     |
| PH3-11 | Admin dashboard                                              | All      |
| PH3-12 | Queue monitoring UI (Bull Board)                             | Queue    |

Phase 3 Exit Criteria:

- npx create-kast-app completes in under 5 minutes
- All 107 API endpoints tested and documented
- Security audit passes all 25 checklist items
- Public GitHub repo with README, CONTRIBUTING, LICENSE

---

## 5. Cross-Cutting Requirements

These apply to every module without exception.

### CR-01 — TypeScript Strict Mode

Every module written with strict: true. No any. No @ts-ignore. Enforced by ESLint and CI.

### CR-02 — Audit Every Mutation

Every POST, PATCH, PUT, DELETE writes an AuditLog entry. The audit interceptor runs globally — no module can opt out.

### CR-03 — Three-Layer Security

Every request passes through: CORS check then Rate limit then Auth guard. No endpoint bypasses any layer without explicit documented decision.

### CR-04 — BullMQ for Background Work

Any operation taking more than 100ms or needing retry logic goes to BullMQ. No blocking operations in HTTP request handlers.

### CR-05 — Consistent Error Shape

Every error uses the standard envelope: { error: { code, message, statusCode, timestamp, path } }. No raw errors leak to clients.

### CR-06 — Soft Delete with Trash

Deletions on ContentEntry, MediaFile, User, Form are soft. Permanently deleted by BullMQ after 30 days. SUPER_ADMIN can permanently delete immediately.

### CR-07 — i18n Ready

All admin UI strings use the i18n framework. Ships in English. RTL support built in.

### CR-08 — RTL Support

Admin UI renders correctly for Arabic and all RTL locales. CSS uses logical properties. Direction switches per locale.

### CR-09 — Zero Console.log in Production

All logging uses NestJS Logger with structured JSON output. console.log in production is an ESLint error.

### CR-10 — Env Validated on Startup

Missing or invalid environment variables cause the application to refuse startup and log exactly which variables are wrong.

---

## 6. Installation and CLI

### Overview

The installation experience is Kast's "easy like WordPress" moment. A developer with Node.js installed runs one command and has a working CMS in under 5 minutes.

### Business Requirements

| ID         | Requirement                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------- |
| BR-INS-001 | The system must provide npx create-kast-app that scaffolds a complete working project           |
| BR-INS-002 | The CLI must support interactive setup with sane defaults requiring zero configuration to start |
| BR-INS-003 | The generated project must include docker-compose.yml that starts all services with one command |
| BR-INS-004 | The CLI must validate Node.js version (>=20) and fail with a clear message if incompatible      |
| BR-INS-005 | After setup, the project must expose three URLs: /admin, /api/v1, /mcp                          |
| BR-INS-006 | The CLI must support one-click deploy templates for Railway, Render, and Vercel                 |
| BR-INS-007 | The generated project must include .env.example with all required variables documented          |
| BR-INS-008 | The CLI must optionally install first-party plugins during setup                                |

### User Stories

| ID         | Story                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| US-INS-001 | As a Developer, I want to run npx create-kast-app and answer a few questions so I have a working CMS without reading docs |
| US-INS-002 | As a Developer, I want docker-compose up to start everything so I do not have to configure databases manually             |
| US-INS-003 | As a Developer, I want TypeScript configured correctly in the generated project so I can start extending immediately      |
| US-INS-004 | As an Agency Developer, I want to select plugins during setup so client projects are pre-configured                       |
| US-INS-005 | As a Developer, I want a Railway deploy button so I can get a production URL in under 10 minutes                          |

### Acceptance Criteria

| ID         | Given                                  | When                                 | Then                                                                                                                  |
| ---------- | -------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| AC-INS-001 | Developer has Node.js >=20 installed   | They run npx create-kast-app my-site | CLI prompts: project name, DB port, admin port, enable i18n, default languages, storage provider, optional plugins    |
| AC-INS-002 | CLI completes successfully             | Developer runs docker-compose up     | All services start, admin accessible at localhost:3001/admin, API at localhost:3001/api/v1, MCP at localhost:3001/mcp |
| AC-INS-003 | Developer has Node.js 18               | They run npx create-kast-app         | CLI prints "Kast requires Node.js >= 20. You have 18.x." and exits with code 1                                        |
| AC-INS-004 | Setup completes                        | Developer opens admin URL            | First-run setup wizard shown (create SUPER_ADMIN account)                                                             |
| AC-INS-005 | Developer uses --skip-interactive flag | Running the CLI                      | Project generated with all defaults (English only, local storage, no plugins)                                         |
| AC-INS-006 | Developer selects Railway deploy       | CLI completes                        | railway.json included and "Deploy to Railway" link printed                                                            |

### CLI Interaction Flow

```
$ npx create-kast-app

  KAST CMS — Cast Your Content Everywhere — v1.0.0

? Project name: my-site
? API port: 3001
? Enable i18n (multiple languages)? Yes
? Default language: English (en)
? Add more languages? Arabic (ar)
? Storage provider: Local filesystem (change later)
? Install plugins now?
  [x] @kast/plugin-meilisearch (search)
  [ ] @kast/plugin-stripe (payments)
  [x] @kast/plugin-sentry (error tracking)

Installing dependencies...
Generating project structure...
Configuring Docker Compose...

Done! Project created in ./my-site

Next steps:
  cd my-site
  cp .env.example .env
  docker-compose up

  Admin:  http://localhost:3001/admin
  API:    http://localhost:3001/api/v1
  MCP:    http://localhost:3001/mcp
```

### Error States

| ID         | Scenario                        | Behavior                                                         |
| ---------- | ------------------------------- | ---------------------------------------------------------------- |
| ER-INS-001 | Node.js version < 20            | Print version error, exit code 1, suggest upgrade command        |
| ER-INS-002 | Target directory already exists | Ask "Directory exists. Overwrite? (y/N)" — default No            |
| ER-INS-003 | pnpm not found                  | Print "pnpm is required. Install with: npm i -g pnpm"            |
| ER-INS-004 | Network failure                 | Retry 3 times then print error with offline install instructions |
| ER-INS-005 | Port already in use             | Detect at setup time, suggest alternative port                   |
| ER-INS-006 | Docker not installed            | Note: "Docker not found — you can run manually with pnpm dev"    |

### Performance Requirements

| ID         | Requirement                                             | Target                               |
| ---------- | ------------------------------------------------------- | ------------------------------------ |
| PF-INS-001 | CLI setup time (interactive)                            | Under 3 minutes on average broadband |
| PF-INS-002 | Cold start from docker-compose up to first API response | Under 30 seconds                     |
| PF-INS-003 | First-run admin setup wizard load                       | Under 2 seconds                      |

---

## 7. Authentication Module

### Overview

Handles all identity: login, logout, OAuth, JWT tokens, password management, and the first-run SUPER_ADMIN setup wizard.

### Business Requirements

| ID         | Requirement                                                                                |
| ---------- | ------------------------------------------------------------------------------------------ |
| BR-AUT-001 | The system must support email/password authentication with bcrypt hashing (cost factor 12) |
| BR-AUT-002 | JWT access tokens must expire in 15 minutes. Refresh tokens in 30 days.                    |
| BR-AUT-003 | Refresh tokens must rotate on every use — old token immediately revoked                    |
| BR-AUT-004 | The system must support OAuth login with Google and GitHub                                 |
| BR-AUT-005 | On first install with no users, system must show setup wizard to create SUPER_ADMIN        |
| BR-AUT-006 | Failed login attempts must be rate-limited to 20 per 15 minutes per IP                     |
| BR-AUT-007 | Password reset must work via email with a 1-hour TTL token                                 |
| BR-AUT-008 | Password reset endpoint must never reveal whether an email exists                          |
| BR-AUT-009 | All auth events must be written to the audit log with IP address                           |
| BR-AUT-010 | The system must support concurrent sessions from multiple devices                          |

### User Stories

| ID         | Story                                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| US-AUT-001 | As SUPER_ADMIN, I want a setup wizard on first install so I do not have to run CLI commands to create my account |
| US-AUT-002 | As any User, I want to log in with email and password to access the admin panel                                  |
| US-AUT-003 | As any User, I want to log in with Google or GitHub so I do not need a separate password                         |
| US-AUT-004 | As any User, I want to reset my password via email so I can recover my account                                   |
| US-AUT-005 | As any User, I want my session to persist across browser refreshes so I do not log in every 15 minutes           |
| US-AUT-006 | As SUPER_ADMIN, I want all login events logged with IP so I can detect suspicious access                         |

### Acceptance Criteria

| ID         | Given                            | When                                      | Then                                                                                  |
| ---------- | -------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| AC-AUT-001 | No users exist                   | Admin URL is opened                       | First-run setup wizard shown — no other page accessible                               |
| AC-AUT-002 | Setup wizard shown               | SUPER_ADMIN submits name, email, password | Account created, user logged in, redirected to dashboard                              |
| AC-AUT-003 | Valid credentials                | User submits login                        | Access token (15min) and refresh token (30 days) returned. Redirected to dashboard.   |
| AC-AUT-004 | Invalid credentials              | User submits login                        | 401 shown. Attempt written to audit log with IP.                                      |
| AC-AUT-005 | 20 failed attempts in 15 minutes | Another attempt made                      | 429 returned. "Too many attempts. Try again in X minutes."                            |
| AC-AUT-006 | Access token expires             | Browser makes API call                    | SDK auto-calls /auth/refresh, gets new token, retries original call transparently     |
| AC-AUT-007 | Refresh token used               | New tokens issued                         | Old refresh token revoked immediately                                                 |
| AC-AUT-008 | Password reset requested         | Email received                            | Token valid for exactly 1 hour. After reset, all refresh tokens for user revoked.     |
| AC-AUT-009 | Non-existent email for reset     | User submits                              | Returns same success message as valid email                                           |
| AC-AUT-010 | User connects Google OAuth       | Redirected back                           | If email matches existing user, accounts linked. If new, User + OAuthAccount created. |

### Admin UI — Login Screen

Route: /admin/login

Layout: Centered card on full-height gradient background

Elements:

- Kast logo + "Cast Your Content Everywhere" tagline
- Email input (autofocus)
- Password input (with show/hide toggle)
- "Forgot password?" link (right-aligned below password)
- "Sign in" primary button (full width)
- Divider: "Or continue with"
- "Continue with Google" button
- "Continue with GitHub" button
- Version number in footer

States:

- Default: form ready
- Loading: button spinner, inputs disabled
- Error: red banner above form "Invalid email or password"
- Rate limited: red banner "Too many attempts. Try again in X minutes." with countdown
- OAuth redirect: spinner "Redirecting to Google..."

### Admin UI — First-Run Setup Wizard

Route: /admin/setup (only when zero users in DB)

Step 1 of 2 — Create account:

- Heading: "Welcome to Kast. Set up your admin account."
- Full name input
- Email input
- Password input (with strength indicator: Weak / Fair / Strong / Very Strong)
- Confirm password input
- "Create account" button
- Note: "This will be your Super Admin account with full access."

Step 2 of 2 — About your site:

- Site name input (pre-populates GlobalSetting site.name)
- Default language dropdown
- "Finish setup" button

After completion: brief success animation, redirect to dashboard, onboarding tooltips begin.

### Admin UI — Forgot Password

Screen 1 (/admin/forgot-password):

- Email input
- "Send reset link" button
- After submit: "If this email is registered, a reset link has been sent." (always shown)

Screen 2 (/admin/reset-password?token=...):

- New password input with strength indicator
- Confirm password input
- "Reset password" button
- If token invalid/expired: "This reset link has expired. Request a new one."

### Error States

| ID         | Scenario                                | Behavior                                                                 |
| ---------- | --------------------------------------- | ------------------------------------------------------------------------ |
| ER-AUT-001 | Wrong password                          | Generic "Invalid email or password" — never specify which                |
| ER-AUT-002 | Trashed user login                      | "Your account has been deactivated. Contact your administrator."         |
| ER-AUT-003 | JWT tampered                            | 401 with INVALID_TOKEN code                                              |
| ER-AUT-004 | Both JWT and refresh expired            | Force logout, redirect to login "Session expired. Please sign in again." |
| ER-AUT-005 | OAuth provider unavailable              | "Could not connect to Google. Try email/password login."                 |
| ER-AUT-006 | Reset token used twice                  | "This reset link has already been used."                                 |
| ER-AUT-007 | Reset token expired                     | "This reset link has expired. Request a new one."                        |
| ER-AUT-008 | Password too weak                       | Inline: "Password must be at least 8 characters and include a number"    |
| ER-AUT-009 | Setup wizard accessed after users exist | Redirect to /admin/login                                                 |
| ER-AUT-010 | Setup wizard password mismatch          | Inline: "Passwords do not match"                                         |

### Performance Requirements

| ID         | Requirement                   | Target                                         |
| ---------- | ----------------------------- | ---------------------------------------------- |
| PF-AUT-001 | Login API response time       | Under 500ms p95 (bcrypt is intentionally slow) |
| PF-AUT-002 | JWT verification time         | Under 5ms p99                                  |
| PF-AUT-003 | Login page load               | Under 1.5s LCP                                 |
| PF-AUT-004 | Session refresh (transparent) | Under 200ms p95 — user must not notice         |

---

## 8. Content Types Module

### Overview

Content types define the structure of content. A content type is like a table definition — it has a name and fields. Entries are rows. This is where the schema is built.

### Business Requirements

| ID         | Requirement                                                                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-SCH-001 | ADMIN and SUPER_ADMIN must be able to create content types with name, displayName, description, icon                                                      |
| BR-SCH-002 | Content type names must be lowercase hyphen-separated slugs and globally unique                                                                           |
| BR-SCH-003 | Each content type can have unlimited fields                                                                                                               |
| BR-SCH-004 | Supported field types: TEXT, RICH_TEXT, NUMBER, BOOLEAN, DATE, DATETIME, MEDIA, RELATION, JSON, COMPONENT, BLOCK, SELECT, MULTI_SELECT, COLOR, URL, EMAIL |
| BR-SCH-005 | Fields must support: isRequired, isLocalized, isUnique, isHidden, position, config, defaultValue                                                          |
| BR-SCH-006 | Field names must be unique within a content type                                                                                                          |
| BR-SCH-007 | Content type names and field types cannot be changed after creation                                                                                       |
| BR-SCH-008 | A content type with existing entries cannot be deleted                                                                                                    |
| BR-SCH-009 | System content types (isSystem: true) cannot be modified or deleted                                                                                       |
| BR-SCH-010 | Field positions must be reorderable via drag-and-drop                                                                                                     |
| BR-SCH-011 | Field-level permissions must be configurable per role                                                                                                     |
| BR-SCH-012 | All schema changes must be written to the audit log                                                                                                       |

### User Stories

| ID         | Story                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| US-SCH-001 | As an ADMIN, I want to create a Blog Post content type with title, body, and hero image so editors can create blog posts |
| US-SCH-002 | As an ADMIN, I want to add a relation field linking Blog Post to Author so entries can reference each other              |
| US-SCH-003 | As an ADMIN, I want to mark a field as localized so editors write different content per language                         |
| US-SCH-004 | As an ADMIN, I want to reorder fields by dragging so the editorial form looks logical                                    |
| US-SCH-005 | As an ADMIN, I want to restrict a salary field to ADMIN-only so editors cannot see sensitive data                        |
| US-SCH-006 | As a Developer, I want content type schemas as TypeScript types via SDK so my frontend is type-safe                      |

### Acceptance Criteria

| ID         | Given                                                   | When                                               | Then                                                                                 |
| ---------- | ------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| AC-SCH-001 | ADMIN is logged in                                      | They create content type "blog-post"               | ContentType record created, name stored as "blog-post", available in API immediately |
| AC-SCH-002 | "blog-post" type exists                                 | ADMIN adds TEXT field "title" with isRequired=true | ContentField record created, field appears in editorial form                         |
| AC-SCH-003 | Field "title" exists                                    | ADMIN tries to create another "title" field        | 409 CONFLICT "A field named title already exists on this content type"               |
| AC-SCH-004 | Content type has 5 entries                              | ADMIN attempts to delete                           | 422 "Cannot delete content type with existing entries (5 found)"                     |
| AC-SCH-005 | ADMIN creates RELATION field                            | They select "Author" as target                     | Field accepts entry IDs from Author type. Editorial UI shows content picker.         |
| AC-SCH-006 | ADMIN sets fieldPermissions read: ["ADMIN"] on "salary" | EDITOR loads an entry                              | "salary" field silently absent from response. No 403 returned.                       |
| AC-SCH-007 | Content type created                                    | Developer calls SDK getTypes()                     | Returns typed schema usable in TypeScript                                            |
| AC-SCH-008 | ADMIN reorders fields via drag                          | Save clicked                                       | ContentField.position values updated, editorial form re-renders in new order         |

### Admin UI — Content Type List

Route: /admin/schema

Layout:

- Page heading "Content Types" + "New Content Type" button
- Grid of content type cards (2 columns desktop, 1 mobile)
- Each card: icon, displayName, field count, entry count, system badge if applicable
- Hover state: "Edit Schema" and "View Entries" actions
- Empty state: "No content types yet. Create your first one." with CTA

### Admin UI — Content Type Builder

Route: /admin/schema/:typeName

Two-column layout:

- Left (60%): Current fields with drag handles
- Right (40%): Add/edit field panel (slides in on field click)

Field list item shows: drag handle, type icon, display name + field name, required badge, localized badge, hidden badge, edit and delete buttons.

Add/Edit field panel:

Step 1 (new field): Choose type — grid of field type cards with icons, searchable, grouped by category.

Step 2 (configure):

- Display name input (auto-generates slug in real time)
- Field name (read-only after creation, shown in code style)
- Required toggle
- Localized toggle
- Unique toggle
- Hidden in admin toggle
- Type-specific config (maxLength for TEXT, allowedTypes for MEDIA, etc.)
- Default value input
- "Save field" button

Field permissions accordion at bottom:

- "Read access" multi-select of roles
- "Write access" multi-select of roles
- Note: "Leave empty to inherit content type permissions"

### Error States

| ID         | Scenario                                                     | Behavior                                                                   |
| ---------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| ER-SCH-001 | Name has uppercase or spaces                                 | Inline: "Name must be lowercase letters and hyphens only (e.g. blog-post)" |
| ER-SCH-002 | Name already exists                                          | 409 "A content type named blog-post already exists"                        |
| ER-SCH-003 | Delete type with entries                                     | 422 show entry count, offer link to view them                              |
| ER-SCH-004 | Delete required system field                                 | 403 "System fields cannot be deleted"                                      |
| ER-SCH-005 | RELATION field targets deleted type                          | Validation error "Target content type does not exist"                      |
| ER-SCH-006 | Field position update fails                                  | Revert to previous order, toast "Reorder failed. Please try again."        |
| ER-SCH-007 | Name conflicts with reserved words (user, media, seo, admin) | 409 "This name is reserved by Kast. Choose a different name."              |

### Performance Requirements

| ID         | Requirement                   | Target                           |
| ---------- | ----------------------------- | -------------------------------- |
| PF-SCH-001 | Content type list load        | Under 300ms API response         |
| PF-SCH-002 | Schema builder with 50 fields | Under 1s page load               |
| PF-SCH-003 | Field save                    | Under 200ms API response         |
| PF-SCH-004 | SDK type generation           | Under 500ms for 20 content types |

---

## 9. Content Entries Module

### Overview

Content entries are the actual content — blog posts, products, pages, etc. This module covers the editorial lifecycle: create, edit, draft, schedule, publish, unpublish, version history, and restore.

### Business Requirements

| ID         | Requirement                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| BR-CON-001 | EDITOR and above must be able to create entries of any content type as DRAFT                                       |
| BR-CON-002 | Entries must have lifecycle: DRAFT to PUBLISHED to ARCHIVED (and SCHEDULED or TRASHED at any point)                |
| BR-CON-003 | Entries can have content in multiple locales. Each locale has its own slug and localized field data.               |
| BR-CON-004 | Publishing must trigger BullMQ SEO validation. SEO errors block publish. Warnings allow publish with force=true.   |
| BR-CON-005 | Every save must create a new ContentEntryVersion snapshot                                                          |
| BR-CON-006 | Editors must be able to revert to any previous version. Revert creates a new version rather than deleting history. |
| BR-CON-007 | Entries can be scheduled to publish at a future date/time via BullMQ kast.publish delayed jobs                     |
| BR-CON-008 | Bulk operations must be supported: publish many, unpublish many, trash many                                        |
| BR-CON-009 | Entry list must support filtering by status, locale, date range, and full-text search                              |
| BR-CON-010 | AI-generated entries must be flagged with isAiGenerated=true and visually marked in admin                          |
| BR-CON-011 | Non-localized fields are shared across all locales. Localized fields have separate values per locale.              |

### User Stories

| ID         | Story                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| US-CON-001 | As an EDITOR, I want to create a new blog post as a draft so I can work on it before publishing                        |
| US-CON-002 | As an EDITOR, I want to see a live SEO score before publishing so I can fix issues first                               |
| US-CON-003 | As an EDITOR, I want to schedule a post to publish Monday at 9am so I do not have to be online                         |
| US-CON-004 | As an EDITOR, I want to compare version 3 with version 5 so I can see what changed                                     |
| US-CON-005 | As an EDITOR, I want to revert to version 2 so I can undo a bad edit                                                   |
| US-CON-006 | As an EDITOR, I want to write English and Arabic versions in the same editor so I do not switch tools                  |
| US-CON-007 | As an ADMIN, I want to bulk-publish 20 drafts at once so I can launch a content series efficiently                     |
| US-CON-008 | As a VIEWER, I want read-only access to entries so I can review without accidentally changing anything                 |
| US-CON-009 | As a Developer, I want the entry list API to filter by status and locale so my frontend fetches only published content |

### Acceptance Criteria

| ID         | Given                                     | When                               | Then                                                                                                                |
| ---------- | ----------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| AC-CON-001 | EDITOR is logged in                       | Creates entry for "blog-post" type | Entry created as DRAFT. First ContentEntryVersion (v1) created. Audit log written.                                  |
| AC-CON-002 | Entry is DRAFT, SEO score below threshold | EDITOR clicks Publish              | SEO panel shows issues. "Publish Anyway" shown if only warnings. If errors, Publish is disabled.                    |
| AC-CON-003 | Entry is PUBLISHED                        | EDITOR edits it                    | Entry saves as new version, status stays PUBLISHED. "Publish changes" button appears.                               |
| AC-CON-004 | Entry is DRAFT                            | EDITOR sets future publish date    | Status changes to SCHEDULED. BullMQ delayed job created. At scheduled time, status becomes PUBLISHED automatically. |
| AC-CON-005 | Entry has 5 versions                      | EDITOR clicks "Restore to v3"      | New version v6 created with v3 data. Versions 1-5 still accessible.                                                 |
| AC-CON-006 | Entry has EN locale                       | EDITOR clicks "Add Arabic"         | New ContentEntryLocale created for "ar". Editor sees AR fields tab. EN fields still editable.                       |
| AC-CON-007 | EDITOR selects 10 draft entries           | Clicks "Publish selected"          | Confirmation dialog. After confirm, all 10 queued to BullMQ and published.                                          |
| AC-CON-008 | Published entry is trashed                | Searched via delivery API          | Entry absent from delivery results. Returns 404 if accessed by slug.                                                |
| AC-CON-009 | Entry field is AI-generated               | Entry shown in admin list          | "AI" badge shown on entry card                                                                                      |

### Admin UI — Entry List

Route: /admin/content/:typeName

Layout:

- Heading: content type display name + "New Entry" button
- Filter bar: Status dropdown, Locale dropdown, Search input, Date range picker
- Bulk action bar (appears when entries checked): Publish, Unpublish, Trash, count badge
- Table view (default) or card view (toggle):
  - Checkbox column
  - Entry title (from first TEXT field or ID if empty)
  - Status badge (Draft=grey, Published=green, Scheduled=blue, Archived=orange, Trashed=red)
  - AI badge (purple "AI" pill if isAiGenerated)
  - Locales (flag icons for each available locale)
  - Last updated date
  - Updated by avatar + name
  - Actions: Edit, Trash, More menu (Duplicate, Schedule, View versions)
- Pagination: "Showing 1-20 of 142" with cursor-based next/prev
- Empty state: "No [type name] yet. Create your first one."

### Admin UI — Entry Editor

Route: /admin/content/:typeName/:id  
Route (new): /admin/content/:typeName/new

Three-panel layout:

Left sidebar (240px):

- Back arrow to entry list
- Entry status badge (clickable)
- "Publish" primary CTA button
- "Save draft" secondary button
- Locale switcher tabs (EN, AR, + Add locale)
- SEO Score panel (collapsed by default):
  - Score circle 0-100 (red under 50, yellow 50-79, green 80+)
  - "Validate" button
  - Issue list with error and warning icons
- Versions panel (collapsed):
  - "Version history" toggle
  - List: "v4 — Apr 22, 2026 — Oday" (current highlighted)
  - "Restore" button per version

Main area:

- Entry fields rendered dynamically from ContentType.fields
- Field type editors:
  - TEXT: single-line input
  - RICH_TEXT: Tiptap rich text editor
  - NUMBER: number input with min/max from config
  - BOOLEAN: toggle switch
  - DATE / DATETIME: date picker
  - MEDIA: media picker opening media library overlay
  - RELATION: content picker (searchable dropdown of target entries)
  - SELECT: dropdown
  - MULTI_SELECT: multi-select chips
  - JSON: Monaco code editor in JSON mode
  - COLOR: color picker
  - URL, EMAIL: text input with format validation
- Localized fields show language badge
- Non-localized fields show "Shared across all locales" note

Top bar:

- Breadcrumb: Content Types > Blog Posts > "Hello World"
- Auto-save indicator: "Saving..." / "Saved 2 minutes ago" / "Unsaved changes"
- Keyboard shortcut: Ctrl+S saves draft

### Admin UI — Version History Panel

Timeline list (newest first):

- v5 (current) — Apr 22, 2026 — 10:04am — Oday
- v4 — Apr 21, 2026 — 3:12pm — Oday
- v3 — Apr 20, 2026 — 9:00am — claude-sonnet-4 [AI badge]
- v2 — Apr 19, 2026 — 11:30am — Oday
- v1 — Apr 18, 2026 — 2:00pm — Oday (Created)

Click any version: right panel slides in with full field data for that version + "Restore to this version" button.

Diff view toggle: "Show changes from v4 to v5" with field-by-field diff highlighting.

### Error States

| ID         | Scenario                                             | Behavior                                                                         |
| ---------- | ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| ER-CON-001 | Publish with SEO errors                              | Publish button disabled. Error list shown. "Fix errors to publish."              |
| ER-CON-002 | Publish with SEO warnings                            | Publish enabled with yellow badge. "Publish Anyway" confirms with warning count. |
| ER-CON-003 | Schedule date in the past                            | Inline error: "Scheduled date must be in the future"                             |
| ER-CON-004 | Required field empty on publish                      | Field highlighted red, "This field is required"                                  |
| ER-CON-005 | Duplicate slug in locale                             | 409 "A blog-post with slug hello-world already exists in English"                |
| ER-CON-006 | Auto-save fails                                      | Warning bar: "Could not auto-save. Last saved: 5 minutes ago."                   |
| ER-CON-007 | Version restore to current version                   | "This is already the current version" — no action taken                          |
| ER-CON-008 | Bulk publish with some SEO errors                    | Result: "8 published. 2 skipped (SEO errors). See details."                      |
| ER-CON-009 | VIEWER tries to edit entry                           | Edit form is read-only. "You have view-only access." banner shown.               |
| ER-CON-010 | Scheduled publish fails (SEO errors at publish time) | Entry stays SCHEDULED, audit log records failure, admin notified via webhook     |

### Performance Requirements

| ID         | Requirement                   | Target                             |
| ---------- | ----------------------------- | ---------------------------------- |
| PF-CON-001 | Entry list load (20 items)    | Under 300ms API response           |
| PF-CON-002 | Entry editor initial load     | Under 800ms including field schema |
| PF-CON-003 | Auto-save debounce            | 2 seconds after last keystroke     |
| PF-CON-004 | Auto-save API call            | Under 200ms p95                    |
| PF-CON-005 | Version restore               | Under 500ms API response           |
| PF-CON-006 | Bulk publish 100 entries      | Under 5 seconds total via BullMQ   |
| PF-CON-007 | Delivery API with Redis cache | Under 50ms p95                     |

## 10. SEO Module

### Overview

SEO is not a plugin in Kast — it is infrastructure. Every content entry has associated SEO metadata. The module includes live validation via the SEO MCP server, XML sitemaps, redirect management, and structured data.

### Business Requirements

| ID         | Requirement                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-SEO-001 | Every ContentEntry must have an associated SeoMeta record created automatically on entry creation                                           |
| BR-SEO-002 | SeoMeta must support: metaTitle, metaDescription, OG fields, Twitter card fields, canonicalUrl, noIndex, noFollow, structuredData (JSON-LD) |
| BR-SEO-003 | The system must auto-generate an XML sitemap at /api/v1/delivery/sitemap.xml covering all published entries across all locales              |
| BR-SEO-004 | The sitemap must include hreflang alternate links for all locales per URL                                                                   |
| BR-SEO-005 | The system must provide a redirect manager for 301 and 302 redirects with bulk CSV import/export                                            |
| BR-SEO-006 | Publishing an entry must trigger async SEO validation via the BullMQ kast.seo queue                                                         |
| BR-SEO-007 | SEO validation results must be stored as SeoScore + SeoIssue records in the database                                                        |
| BR-SEO-008 | The admin UI must display the SEO score inline in the entry editor before publish                                                           |
| BR-SEO-009 | SEO errors must block publish. SEO warnings allow publish with force confirmation.                                                          |
| BR-SEO-010 | The SEO MCP endpoint must be configurable in GlobalSettings to point at any compatible MCP server                                           |
| BR-SEO-011 | Historical SEO scores per entry must be queryable to track improvement over time                                                            |
| BR-SEO-012 | Each redirect rule must track hitCount for analytics                                                                                        |

### User Stories

| ID         | Story                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------- |
| US-SEO-001 | As an EDITOR, I want to see my SEO score before I publish so I can fix issues without a separate tool                 |
| US-SEO-002 | As an EDITOR, I want specific actionable SEO issues listed so I know exactly what to fix                              |
| US-SEO-003 | As an ADMIN, I want a sitemap generated automatically so search engines can crawl my site without configuration       |
| US-SEO-004 | As an ADMIN, I want to create a redirect from /old-page to /new-page so I do not lose SEO value when renaming content |
| US-SEO-005 | As an ADMIN, I want to import 100 redirects from CSV so I can migrate from an old CMS without manual entry            |
| US-SEO-006 | As a Developer, I want to configure which SEO MCP server Kast calls so I can use my own validation tool               |
| US-SEO-007 | As an ADMIN, I want to see SEO score history for an entry so I can track improvement over time                        |

### Acceptance Criteria

| ID         | Given                                          | When                             | Then                                                                                                             |
| ---------- | ---------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| AC-SEO-001 | New content entry created                      | System processes creation        | SeoMeta record auto-created with all null defaults, associated to the entry                                      |
| AC-SEO-002 | EDITOR fills in meta title and description     | They save the entry              | SeoMeta record updated. SEO validation queued in BullMQ kast.seo.                                                |
| AC-SEO-003 | SEO validation completes                       | Results available                | SeoScore record created with score 0-100. SeoIssue records created per issue with severity and penalty.          |
| AC-SEO-004 | Entry has SEO errors (severity: ERROR)         | EDITOR clicks Publish            | Publish button is disabled. Error list shown in SEO panel. No publish until errors resolved.                     |
| AC-SEO-005 | Entry has only SEO warnings                    | EDITOR clicks Publish            | Yellow warning badge shown. "Publish Anyway" button available. Clicking confirms with issue count.               |
| AC-SEO-006 | Sitemap requested                              | GET /api/v1/delivery/sitemap.xml | Returns valid XML sitemap with all published entries, hreflang alternates for each locale, correct lastmod dates |
| AC-SEO-007 | ADMIN creates redirect from /old to /new       | Redirect saved                   | GET /old returns 301 redirect to /new. hitCount increments on each hit.                                          |
| AC-SEO-008 | ADMIN imports 50 redirects via CSV             | File uploaded                    | 50 redirects created, duplicates skipped with count, errors reported per row                                     |
| AC-SEO-009 | Developer changes SEO_MCP_ENDPOINT in settings | Validation triggered             | Kast calls the new endpoint, not the default                                                                     |
| AC-SEO-010 | Entry validated 5 times over 2 weeks           | Admin views score history        | Chart showing 5 data points with scores and dates                                                                |

### Admin UI — SEO Panel in Entry Editor

Location: Left sidebar of entry editor (collapsed by default)

Expanded state:

- Score circle: large number (e.g. "78") with circular progress indicator
  - Red: 0-49 | Yellow: 50-79 | Green: 80-100
- "Last validated: 5 minutes ago" timestamp
- "Re-validate" button (triggers BullMQ job, shows spinner while pending)
- Issue list:
  - ERROR items (red X icon): "Missing meta description" (-20 pts)
  - WARNING items (yellow warning icon): "Title too short — should be 50-60 chars" (-5 pts)
  - INFO items (blue info icon): "Consider adding structured data" (0 pts)
- "SEO Checklist" link → opens full SEO detail panel

Full SEO detail panel (opens as modal or right drawer):

- Meta section:
  - Meta title input with character counter (green 50-60, yellow outside range)
  - Meta description input with character counter (green 120-160, yellow outside range)
  - Preview card: shows how it will look in Google search results (live preview)
- Open Graph section:
  - OG title, description, image picker (from media library)
  - Preview: shows Facebook/LinkedIn share preview
- Twitter Card section:
  - Twitter title, description, image picker
- Advanced section:
  - Canonical URL input
  - noIndex toggle
  - noFollow toggle
  - JSON-LD structured data editor (Monaco, JSON mode with schema validation)

### Admin UI — SEO Dashboard

Route: /admin/seo

Tabs:

- Overview: site-wide SEO health metrics
- Redirects: redirect manager
- Score History: top entries by SEO score improvement/decline

Redirects tab:

- Filter bar: isActive toggle, Type dropdown (301/302), search
- Table: From Path, To Path, Type, Active toggle, Hit Count, Created date, Actions
- "New Redirect" button
- "Import CSV" button
- "Export CSV" button
- New/Edit redirect form (modal):
  - From path input
  - To path input
  - Type radio: 301 Permanent / 302 Temporary
  - Is active toggle

### Error States

| ID         | Scenario                                        | Behavior                                                                                               |
| ---------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| ER-SEO-001 | SEO MCP server unreachable                      | Toast: "SEO validation unavailable. You can still publish — validation will retry." Score shows as "?" |
| ER-SEO-002 | SEO MCP returns invalid response                | Log error, show "Validation failed. Try again." No score stored.                                       |
| ER-SEO-003 | Duplicate redirect fromPath                     | 409 "A redirect from /old-path already exists"                                                         |
| ER-SEO-004 | CSV import with malformed rows                  | Per-row error: "Row 14: Invalid URL format for fromPath" — valid rows still import                     |
| ER-SEO-005 | Circular redirect (A to B, B to A)              | Validation error: "This redirect creates a loop"                                                       |
| ER-SEO-006 | Entry published with no SEO validation ever run | Warning banner in admin: "This entry has never been SEO validated." — does not block publish           |
| ER-SEO-007 | noIndex set to true                             | Warning banner: "This entry will not be indexed by search engines."                                    |

### Performance Requirements

| ID         | Requirement                           | Target                               |
| ---------- | ------------------------------------- | ------------------------------------ |
| PF-SEO-001 | SEO validation job (BullMQ to result) | Under 10 seconds end-to-end          |
| PF-SEO-002 | SEO panel load in entry editor        | Under 500ms (uses cached last score) |
| PF-SEO-003 | Sitemap generation (1000 entries)     | Under 3 seconds                      |
| PF-SEO-004 | Sitemap response with cache           | Under 100ms p95                      |
| PF-SEO-005 | Redirect lookup (per-request)         | Under 5ms (cached in Redis)          |

---

## 11. Media Module

### Overview

Handles file uploads, storage abstraction, image processing, folder organization, and usage tracking. Media files can be stored locally or on any S3-compatible provider.

### Business Requirements

| ID         | Requirement                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| BR-MED-001 | EDITOR and above must be able to upload files via the admin UI or API                                       |
| BR-MED-002 | The system must support upload via file (multipart) and via remote URL                                      |
| BR-MED-003 | Image processing must run asynchronously via BullMQ kast.media: resize to configured sizes, convert to WebP |
| BR-MED-004 | Storage must be abstracted: local filesystem and S3-compatible (configurable via plugin) are both supported |
| BR-MED-005 | MIME type must be validated by both header and magic bytes — header alone is not trusted                    |
| BR-MED-006 | Maximum file size must be configurable in GlobalSettings (default 50MB)                                     |
| BR-MED-007 | The system must track which entries use which media files (MediaUsage)                                      |
| BR-MED-008 | Media files in use by entries cannot be trashed until all references are removed                            |
| BR-MED-009 | Folders must support unlimited nesting for organization                                                     |
| BR-MED-010 | Alt text must be editable and support AI-generated suggestions (v2 feature, field exists in v1)             |
| BR-MED-011 | The admin must show a media library overlay usable from the entry editor                                    |

### User Stories

| ID         | Story                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| US-MED-001 | As an EDITOR, I want to drag and drop a file to upload it so I do not need to use file dialogs                 |
| US-MED-002 | As an EDITOR, I want to paste an image URL and have Kast download it so I can import from external sources     |
| US-MED-003 | As an EDITOR, I want to pick a media file from the library while editing an entry so I do not leave the editor |
| US-MED-004 | As an EDITOR, I want to edit the alt text of any image so screen readers can describe it                       |
| US-MED-005 | As an ADMIN, I want to organize files into folders so the media library stays manageable                       |
| US-MED-006 | As an ADMIN, I want to see which entries use a media file before I delete it so I do not break anything        |
| US-MED-007 | As a Developer, I want to configure S3 storage via plugin so media is stored in the cloud                      |

### Acceptance Criteria

| ID         | Given                                                      | When                       | Then                                                                                                              |
| ---------- | ---------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| AC-MED-001 | EDITOR uploads a JPEG image                                | File processed             | MediaFile record created. BullMQ kast.media job processes WebP conversion and thumbnail generation. URL returned. |
| AC-MED-002 | EDITOR uploads a file with JPEG header but PNG magic bytes | Upload attempted           | 400 "File type mismatch — content does not match declared type"                                                   |
| AC-MED-003 | EDITOR uploads a 60MB file                                 | Upload attempted           | 413 "File size (60MB) exceeds maximum allowed (50MB)"                                                             |
| AC-MED-004 | File upload completes                                      | EDITOR views media library | File appears with thumbnail, filename, size, type, and upload date                                                |
| AC-MED-005 | Media file is used in 3 entries                            | EDITOR tries to trash it   | 422 "Cannot trash — file is used by 3 entries. View usages."                                                      |
| AC-MED-006 | Media file has no usages                                   | EDITOR trashes it          | File moves to trash. Trashed at timestamp set. Permanently deleted after 30 days by BullMQ.                       |
| AC-MED-007 | EDITOR is in entry editor MEDIA field                      | They click the field       | Media library overlay opens. Search and folder navigation available. Click selects file and closes overlay.       |
| AC-MED-008 | ADMIN creates folder "Blog Images"                         | Folder saved               | MediaFolder record created. Files can be moved to it.                                                             |

### Admin UI — Media Library

Route: /admin/media

Three-panel layout:

- Left (200px): Folder tree
  - Root level
  - Nested folders with expand/collapse
  - "New Folder" button at bottom
  - Drag files onto a folder to move them
- Center: File grid
  - Grid of thumbnails (image preview or file type icon)
  - Each cell: filename (truncated), size, upload date
  - Selection: click to select one, Shift+click for range, checkbox multi-select
  - Right-click context menu: Edit details, Move to folder, Trash
  - Drag handle for moving files
- Right (300px, opens on file click): File detail panel
  - Large preview
  - Filename (editable)
  - Alt text input (editable)
  - File metadata: size, type, dimensions (for images), upload date, uploaded by
  - Storage URL (copyable)
  - "Used in" section: list of entries using this file
  - "Trash file" button (disabled if file is in use)

Top bar:

- Search input
- Type filter (All, Images, Videos, Documents)
- Sort by: Date uploaded, Name, Size
- View toggle: Grid / List
- "Upload" button (opens file picker or drag zone)

Upload overlay (triggered by Upload button or drag onto page):

- Large dashed drop zone "Drop files here or click to browse"
- "Upload from URL" tab
- Upload progress bars per file
- Error display per file

### Admin UI — Media Library Overlay (in Entry Editor)

Opens as modal with same UI as full media library but:

- Single-select mode only (multi-select for MEDIA fields with multiple=true)
- "Insert file" button instead of detail panel
- No trash or folder management
- Search and filter still available

### Error States

| ID         | Scenario                                        | Behavior                                                                                             |
| ---------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| ER-MED-001 | Upload file type not allowed                    | 415 "File type application/exe is not allowed" — list allowed types                                  |
| ER-MED-002 | File exceeds size limit                         | 413 with current and maximum size shown                                                              |
| ER-MED-003 | MIME type mismatch                              | 400 "Content does not match declared file type"                                                      |
| ER-MED-004 | Storage provider unreachable (S3 down)          | 503 "Storage service unavailable. Retry in a moment." File not saved.                                |
| ER-MED-005 | URL upload — URL not accessible                 | 422 "Could not fetch file from the provided URL"                                                     |
| ER-MED-006 | URL upload — URL returns non-media content type | 422 "URL does not point to a supported file type"                                                    |
| ER-MED-007 | Delete folder with files inside                 | 422 "Folder contains 8 files. Move or delete them first."                                            |
| ER-MED-008 | Image processing fails                          | MediaFile record created with original URL. Toast: "Image optimization failed — original file used." |

### Performance Requirements

| ID         | Requirement                              | Target                                |
| ---------- | ---------------------------------------- | ------------------------------------- |
| PF-MED-001 | File upload response (metadata creation) | Under 500ms after upload completes    |
| PF-MED-002 | Image processing job (WebP + thumbnails) | Under 10 seconds for images under 5MB |
| PF-MED-003 | Media library load (50 files)            | Under 600ms                           |
| PF-MED-004 | Media library overlay open               | Under 400ms                           |
| PF-MED-005 | Media delivery URL (CDN)                 | Under 50ms for cached assets          |

---

## 12. i18n and Locales Module

### Overview

Internationalization is first-class in Kast. Every content entry can have multiple locale variants. Arabic and other RTL languages receive specific support including admin UI direction switching.

### Business Requirements

| ID         | Requirement                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-I18-001 | The system must support unlimited locales. Each locale has a code, name, native name, direction (LTR/RTL), and optional fallback locale.    |
| BR-I18-002 | Each locale must have exactly one default locale (isDefault: true)                                                                          |
| BR-I18-003 | Content fields marked isLocalized=true must store separate values per locale in ContentEntryLocale records                                  |
| BR-I18-004 | Content fields marked isLocalized=false share the same value across all locales                                                             |
| BR-I18-005 | URL slugs must be per-locale (slug uniqueness is scoped to locale + slug, not globally)                                                     |
| BR-I18-006 | The admin UI must switch text direction when the interface locale is RTL                                                                    |
| BR-I18-007 | The sitemap must include hreflang alternate links for all active locales                                                                    |
| BR-I18-008 | Locale fallback must work in the delivery API: if content is not available in requested locale, fall back to the configured fallback locale |
| BR-I18-009 | Only ADMIN and SUPER_ADMIN can add or modify locales. Only SUPER_ADMIN can delete a locale.                                                 |
| BR-I18-010 | A locale with content entries cannot be deleted                                                                                             |

### User Stories

| ID         | Story                                                                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-I18-001 | As an EDITOR, I want locale tabs in the entry editor so I can write the Arabic and English versions of a post side by side                                  |
| US-I18-002 | As an EDITOR, I want the admin UI to switch to RTL when I am editing Arabic content so text flows correctly                                                 |
| US-I18-003 | As an ADMIN, I want to add a French locale so editors can write French content                                                                              |
| US-I18-004 | As an ADMIN, I want to set English as the fallback for French so readers get English if French content does not exist                                       |
| US-I18-005 | As a Developer, I want the delivery API to return the fallback locale content when the requested locale is missing so my frontend does not show empty pages |

### Acceptance Criteria

| ID         | Given                                                       | When                               | Then                                                                                           |
| ---------- | ----------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| AC-I18-001 | Two locales active: en, ar                                  | EDITOR opens entry editor          | Locale switcher shows "EN" and "AR" tabs. Switching locale shows different field values.       |
| AC-I18-002 | EDITOR is on AR locale tab                                  | Rich text field shown              | Field renders with direction=RTL, text aligns right, cursor behaves correctly                  |
| AC-I18-003 | Admin UI locale set to Arabic                               | Any admin screen                   | All admin UI text direction is RTL. Sidebar appears on right. All layouts mirror correctly.    |
| AC-I18-004 | Entry exists in EN, not in AR                               | Delivery API called with locale=ar | Falls back to EN content. Response includes "locale": "en" and "requestedLocale": "ar" fields. |
| AC-I18-005 | ADMIN creates locale "fr" with fallback "en"                | Saved                              | Locale record created. Delivery API uses EN fallback for FR content gaps.                      |
| AC-I18-006 | Locale "ar" has 50 entries                                  | SUPER_ADMIN tries to delete it     | 422 "Cannot delete locale with existing content (50 entries)"                                  |
| AC-I18-007 | Entry has EN slug "hello-world" and AR slug "مرحبا-بالعالم" | Both slugs called                  | Each returns correct locale's data. No collision.                                              |

### Admin UI — Locales Settings

Route: /admin/settings/locales

Layout:

- Table of active locales:
  - Code badge (e.g. "en"), Name, Native name, Direction badge (LTR/RTL), Default badge, Active toggle, Fallback locale, Actions
- Default locale row is highlighted
- "Add Locale" button
- Add/Edit locale form (modal):
  - Code input (e.g. "fr")
  - Name input ("French")
  - Native name input ("Français")
  - Direction radio: LTR / RTL
  - Is default toggle (only one can be default)
  - Is active toggle
  - Fallback locale dropdown (other active locales)

### Error States

| ID         | Scenario                   | Behavior                                                                     |
| ---------- | -------------------------- | ---------------------------------------------------------------------------- |
| ER-I18-001 | Invalid locale code        | Inline: "Locale code must follow IETF format (e.g. en, ar, fr-FR)"           |
| ER-I18-002 | Duplicate locale code      | 409 "Locale 'ar' already exists"                                             |
| ER-I18-003 | Delete default locale      | 422 "Cannot delete the default locale. Set another locale as default first." |
| ER-I18-004 | Set fallback to self       | 422 "A locale cannot fall back to itself"                                    |
| ER-I18-005 | Circular fallback chain    | 422 "This creates a circular fallback chain"                                 |
| ER-I18-006 | Delete locale with entries | 422 with entry count shown                                                   |

### Performance Requirements

| ID         | Requirement                       | Target                            |
| ---------- | --------------------------------- | --------------------------------- |
| PF-I18-001 | Locale list load                  | Under 100ms                       |
| PF-I18-002 | Locale tab switch in entry editor | Under 100ms (data already loaded) |
| PF-I18-003 | Delivery API fallback resolution  | Under 10ms additional overhead    |

---

## 13. Users and Roles Module

### Overview

Manages admin user accounts, system and custom roles, and the permission assignment system. Users are human actors who access the admin panel.

### Business Requirements

| ID         | Requirement                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| BR-USR-001 | ADMIN and SUPER_ADMIN must be able to create users by email and assign roles                               |
| BR-USR-002 | Invitation email must be sent on user creation (configurable to skip)                                      |
| BR-USR-003 | System roles (SUPER_ADMIN, ADMIN, EDITOR, VIEWER) cannot be deleted or have their core permissions changed |
| BR-USR-004 | SUPER_ADMIN can create custom roles with any combination of permissions                                    |
| BR-USR-005 | Custom roles cannot have more permissions than the creator's own role (no privilege escalation)            |
| BR-USR-006 | ADMIN cannot modify or trash ADMIN or SUPER_ADMIN accounts                                                 |
| BR-USR-007 | Users support multiple roles simultaneously                                                                |
| BR-USR-008 | User accounts support soft delete (trash) with 30-day recovery                                             |
| BR-USR-009 | SUPER_ADMIN cannot be trashed                                                                              |
| BR-USR-010 | All user management actions must be written to the audit log                                               |

### User Stories

| ID         | Story                                                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| US-USR-001 | As a SUPER_ADMIN, I want to invite a new editor by email so they can access the admin panel                                 |
| US-USR-002 | As a SUPER_ADMIN, I want to create a custom "SEO Manager" role with only SEO permissions so I can assign it to a specialist |
| US-USR-003 | As a SUPER_ADMIN, I want to deactivate a user without deleting them so I can revoke access temporarily                      |
| US-USR-004 | As an ADMIN, I want to see all users and their roles so I can manage the team                                               |
| US-USR-005 | As any User, I want to update my own name and avatar so the admin shows my correct identity                                 |

### Acceptance Criteria

| ID         | Given                                          | When                    | Then                                                                                                              |
| ---------- | ---------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| AC-USR-001 | SUPER_ADMIN creates user                       | Email and role provided | User record created, invitation email sent via BullMQ kast.email, user appears in user list with "Invited" status |
| AC-USR-002 | ADMIN tries to edit another ADMIN account      | Edit submitted          | 403 "Insufficient permissions to modify an Admin account"                                                         |
| AC-USR-003 | SUPER_ADMIN creates custom role "SEO Manager"  | Permissions assigned    | Role available in user role assignment. Cannot exceed creator's permissions.                                      |
| AC-USR-004 | ADMIN trashes a VIEWER user                    | Confirmed               | User.trashedAt set. User cannot log in. Tokens revoked. Recoverable for 30 days.                                  |
| AC-USR-005 | SUPER_ADMIN tries to trash SUPER_ADMIN account | Action attempted        | 422 "Super Admin account cannot be trashed"                                                                       |
| AC-USR-006 | User with active sessions is deactivated       | isActive set to false   | All refresh tokens for that user revoked. Active JWTs expire naturally in 15 minutes.                             |

### Admin UI — Users List

Route: /admin/users

Layout:

- "Users" heading + "Invite User" button
- Table: Avatar + name, Email, Roles badges, Status (Active/Invited/Inactive), Last login, Actions
- Role filter dropdown
- Search by name or email
- Status filter: All / Active / Invited / Inactive / Trashed

### Admin UI — Invite User

Modal form:

- Email input
- First name, Last name inputs (optional)
- Role multi-select (shows available roles as checkboxes)
- "Send invitation" button
- "Create without invitation" option (checkbox)

### Admin UI — User Profile (own)

Route: /admin/profile

- Avatar upload (circular crop)
- First name, Last name inputs
- Email (read-only, shown for reference)
- Change password section (current password + new password + confirm)
- Connected accounts: Google / GitHub OAuth status with Connect/Disconnect
- "Save changes" button
- Danger zone: "Sign out of all devices" button

### Admin UI — Roles

Route: /admin/settings/roles

- System roles listed first (locked icon, cannot edit permissions)
- Custom roles listed below
- "Create Role" button (SUPER_ADMIN only)
- Each role row: name, description, user count, permissions count, Edit / Delete buttons
- Edit role: permission matrix grouped by resource

### Error States

| ID         | Scenario                                | Behavior                                                            |
| ---------- | --------------------------------------- | ------------------------------------------------------------------- |
| ER-USR-001 | Invite email already registered         | 409 "A user with this email already exists"                         |
| ER-USR-002 | Role not found on assignment            | 404 "Role not found"                                                |
| ER-USR-003 | Custom role exceeds creator permissions | 422 "Cannot assign permissions exceeding your own access level"     |
| ER-USR-004 | Delete role with assigned users         | 422 "Cannot delete role assigned to X users. Reassign users first." |
| ER-USR-005 | Delete system role                      | 403 "System roles cannot be deleted"                                |
| ER-USR-006 | User invites themselves                 | 422 "Cannot invite your own email address"                          |

### Performance Requirements

| ID         | Requirement                 | Target                                           |
| ---------- | --------------------------- | ------------------------------------------------ |
| PF-USR-001 | User list load              | Under 200ms                                      |
| PF-USR-002 | Role permission matrix load | Under 300ms                                      |
| PF-USR-003 | Invitation email queue      | Queued within 100ms, delivered within 30 seconds |

---

## 14. Webhooks Module

### Overview

Outbound webhooks allow Kast to notify any external service when content lifecycle events occur. All delivery is via BullMQ with HMAC signing and automatic retry.

### Business Requirements

| ID         | Requirement                                                                                                                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-WHK-001 | ADMIN and SUPER_ADMIN must be able to configure outbound webhook endpoints                                                                                                                                      |
| BR-WHK-002 | Each webhook endpoint must specify the URL, a signing secret, and the events it listens to                                                                                                                      |
| BR-WHK-003 | Webhook payloads must be signed with HMAC-SHA256 using the configured secret                                                                                                                                    |
| BR-WHK-004 | Webhook delivery must be handled by BullMQ kast.webhook queue with exponential backoff retry                                                                                                                    |
| BR-WHK-005 | Delivery logs must store the payload, response status, response body (first 1000 chars), and attempt count                                                                                                      |
| BR-WHK-006 | Failed webhooks must retry automatically: 1 minute, 5 minutes, 30 minutes, 2 hours, 24 hours                                                                                                                    |
| BR-WHK-007 | Admins must be able to manually trigger a test delivery to verify connectivity                                                                                                                                  |
| BR-WHK-008 | Supported events must cover all content lifecycle operations including: content.created, content.updated, content.published, content.unpublished, content.trashed, media.uploaded, form.submitted, user.created |

### User Stories

| ID         | Story                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| US-WHK-001 | As an ADMIN, I want to connect Kast to n8n by adding a webhook URL so my automation workflows trigger on content publish |
| US-WHK-002 | As an ADMIN, I want webhooks signed with HMAC so my receiver can verify the payload is from Kast                         |
| US-WHK-003 | As an ADMIN, I want to see delivery logs so I can debug why my automation did not fire                                   |
| US-WHK-004 | As an ADMIN, I want failed webhooks to retry automatically so I do not have to monitor and re-trigger manually           |
| US-WHK-005 | As an ADMIN, I want to send a test payload to a new endpoint so I can verify connectivity before going live              |

### Acceptance Criteria

| ID         | Given                                                  | When                  | Then                                                                                      |
| ---------- | ------------------------------------------------------ | --------------------- | ----------------------------------------------------------------------------------------- |
| AC-WHK-001 | Webhook endpoint created for event "content.published" | An entry is published | BullMQ job created, POST sent to endpoint URL within 5 seconds, signature header included |
| AC-WHK-002 | Webhook delivery succeeds (2xx response)               | Delivery logged       | WebhookDelivery record: statusCode=200, succeededAt set, attempts=1                       |
| AC-WHK-003 | Webhook endpoint returns 500                           | First delivery fails  | BullMQ schedules retry at 1 min. attempts incremented. After 5 failures, failedAt set.    |
| AC-WHK-004 | ADMIN clicks "Test" on webhook                         | Test payload sent     | GET /api/v1/webhooks/:id/test sends test event, returns response within 10 seconds        |
| AC-WHK-005 | HMAC signature received                                | Receiver verifies     | X-Kast-Signature header contains HMAC-SHA256 of payload body using configured secret      |

### Admin UI — Webhooks

Route: /admin/webhooks

- "Webhooks" heading + "New Webhook" button
- Table: Name, URL (truncated), Events count, Active toggle, Last delivery status, Last delivery date, Actions
- Status indicators: green check (last success), red X (last failed), grey dash (never delivered)

Add/Edit webhook form (modal):

- Name input
- URL input (validated as HTTPS URL)
- Secret input (password field, with "Generate" button)
- Events multi-select (categorized: Content, Media, Forms, Users)
- Active toggle
- "Save" button

Delivery logs for a webhook (slide-out panel):

- Filter: status (succeeded/failed/pending)
- Table: Event name, Status code, Attempts, Created at, Duration
- Click row: expand to show full payload and response body

### Error States

| ID         | Scenario                           | Behavior                                                                            |
| ---------- | ---------------------------------- | ----------------------------------------------------------------------------------- |
| ER-WHK-001 | Invalid URL format                 | Inline: "Must be a valid HTTPS URL"                                                 |
| ER-WHK-002 | Test endpoint returns non-2xx      | Shows status code and response body in test result panel                            |
| ER-WHK-003 | Test endpoint times out            | "Endpoint did not respond within 10 seconds"                                        |
| ER-WHK-004 | All retries exhausted (5 attempts) | WebhookDelivery.failedAt set. Admin notification via another webhook if configured. |
| ER-WHK-005 | Secret not provided                | 400 "A signing secret is required"                                                  |

### Performance Requirements

| ID         | Requirement                           | Target                    |
| ---------- | ------------------------------------- | ------------------------- |
| PF-WHK-001 | Webhook queuing (event to BullMQ job) | Under 100ms               |
| PF-WHK-002 | First delivery attempt                | Within 5 seconds of event |
| PF-WHK-003 | Delivery log load (100 records)       | Under 300ms               |

---

## 15. Plugins Module

### Overview

The plugin system allows Kast to be extended with new capabilities — payment providers, search engines, email services, storage providers, and more. Plugins are sandboxed and can only access what they declare in their manifest.

### Business Requirements

| ID         | Requirement                                                                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-PLG-001 | Only SUPER_ADMIN can install, enable, disable, or uninstall plugins                                                                                      |
| BR-PLG-002 | ADMIN can read plugin list and configuration (sensitive values redacted)                                                                                 |
| BR-PLG-003 | Plugins must declare all permissions in their manifest before installation                                                                               |
| BR-PLG-004 | SUPER_ADMIN must review and approve the declared permission list before a plugin is activated                                                            |
| BR-PLG-005 | Plugins cannot access User, ApiToken, AgentToken, or AuditLog models                                                                                     |
| BR-PLG-006 | Plugin config values (API keys, secrets) must be encrypted at rest using AES-256-GCM                                                                     |
| BR-PLG-007 | System plugins (isSystemPlugin: true) cannot be disabled or uninstalled                                                                                  |
| BR-PLG-008 | All plugin install, enable, disable, and uninstall events must be written to the audit log                                                               |
| BR-PLG-009 | v1 ships with 5 first-party plugins: @kast/plugin-stripe, @kast/plugin-meilisearch, @kast/plugin-resend, @kast/plugin-cloudflare-r2, @kast/plugin-sentry |

### User Stories

| ID         | Story                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| US-PLG-001 | As a SUPER_ADMIN, I want to install the Stripe plugin so the commerce module can process payments             |
| US-PLG-002 | As a SUPER_ADMIN, I want to review exactly what permissions a plugin requires before I install it             |
| US-PLG-003 | As a SUPER_ADMIN, I want to configure the Stripe plugin with my API keys so it connects to my Stripe account  |
| US-PLG-004 | As an ADMIN, I want to see which plugins are installed and active so I understand the system's capabilities   |
| US-PLG-005 | As a Developer, I want to build a plugin using @kast/plugin-sdk so I can extend Kast with custom integrations |

### Acceptance Criteria

| ID         | Given                                    | When                    | Then                                                                                                     |
| ---------- | ---------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| AC-PLG-001 | SUPER_ADMIN installs @kast/plugin-stripe | Install confirmed       | Plugin record created with isActive=false. Permission review screen shown before activation.             |
| AC-PLG-002 | SUPER_ADMIN views plugin permissions     | Before activating       | Full permission list shown: data access, hooks, network URLs, env vars, admin panels                     |
| AC-PLG-003 | SUPER_ADMIN configures Stripe plugin     | API keys entered        | Values encrypted before storage. Config saved. Sensitive values shown as **_REDACTED_** in GET response. |
| AC-PLG-004 | Plugin is active                         | It makes a network call | Only URLs declared in manifest.permissions.network are allowed. Undeclared URLs are blocked.             |
| AC-PLG-005 | SUPER_ADMIN disables a plugin            | isActive set to false   | Plugin's hooks and admin panels immediately deregistered. No restart required.                           |
| AC-PLG-006 | Plugin tries to read User model          | Access attempted        | Access denied with PERMISSION_DENIED. Plugin cannot access undeclared models.                            |

### Admin UI — Plugins

Route: /admin/plugins

Layout:

- Installed plugins cards (2-column grid):
  - Plugin icon, display name, version, description
  - Status badge: Active (green) / Inactive (grey)
  - Enable/Disable toggle
  - "Configure" button (if plugin has config)
  - "Uninstall" button (red, SUPER_ADMIN only)
- "Install Plugin" button (SUPER_ADMIN only)

Install Plugin flow:

1. Enter plugin name (e.g. @kast/plugin-stripe) + version
2. Kast fetches plugin manifest from npm
3. Permission review screen:
   - "This plugin requests the following permissions:"
   - Data access list (read ContentEntry, read MediaFile)
   - Hooks list (content.beforePublish, form.afterSubmit)
   - Network access list (https://api.stripe.com)
   - Environment variables list (STRIPE_SECRET_KEY)
   - Admin panels list (Payments panel in sidebar)
   - "Approve and Install" button | "Cancel" button
4. After install: plugin appears in list as Inactive

Plugin configure modal:

- Form fields derived from plugin's config schema
- Sensitive fields (passwords, API keys) are input type=password
- Saved values shown as **_REDACTED_** with "Edit" button to change
- "Save configuration" button
- Link to plugin's documentation

### Error States

| ID         | Scenario                       | Behavior                                                                                                                        |
| ---------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| ER-PLG-001 | Plugin not found on npm        | "Plugin @kast/plugin-unknown not found. Check the package name."                                                                |
| ER-PLG-002 | Plugin version incompatible    | "Plugin v2.0.0 requires Kast >= 2.0.0. You have 1.0.0."                                                                         |
| ER-PLG-003 | Plugin install fails (network) | "Could not download plugin. Check your internet connection."                                                                    |
| ER-PLG-004 | Uninstall system plugin        | 403 "System plugins cannot be uninstalled"                                                                                      |
| ER-PLG-005 | Missing required config        | Plugin cannot be enabled until all required config values are set. Enable button disabled with tooltip "Configure plugin first" |
| ER-PLG-006 | Plugin config encryption fails | 500 "Could not encrypt plugin configuration. Check PLUGIN_CONFIG_ENCRYPTION_KEY env var."                                       |

### Performance Requirements

| ID         | Requirement                     | Target                            |
| ---------- | ------------------------------- | --------------------------------- |
| PF-PLG-001 | Plugin list load                | Under 200ms                       |
| PF-PLG-002 | Plugin install (manifest fetch) | Under 5 seconds                   |
| PF-PLG-003 | Plugin enable/disable           | Under 500ms (no restart required) |

---

## 16. Forms Module

### Overview

Forms allow collecting structured data from website visitors. Forms are separate from content types — they have submissions, not entries. Form submissions are public (no auth required).

### Business Requirements

| ID         | Requirement                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| BR-FRM-001 | ADMIN and SUPER_ADMIN must be able to create forms with custom fields                                                                 |
| BR-FRM-002 | Public form submission via POST /api/v1/forms/:slug/submit must require no authentication                                             |
| BR-FRM-003 | Form submissions must be rate-limited to 10 per minute per IP to prevent spam                                                         |
| BR-FRM-004 | Form submission endpoint must go through CORS check using allowedOrigins                                                              |
| BR-FRM-005 | Form submissions must be stored in FormSubmission records with the submitted data                                                     |
| BR-FRM-006 | On submission, the form's notifyEmail must receive an email notification via BullMQ kast.email                                        |
| BR-FRM-007 | On submission, a form.submitted webhook event must fire for all subscribed endpoints                                                  |
| BR-FRM-008 | EDITOR and above must be able to read form submissions and mark them as read                                                          |
| BR-FRM-009 | Forms must support the following field types: TEXT, EMAIL, PHONE, NUMBER, TEXTAREA, SELECT, MULTI_SELECT, CHECKBOX, RADIO, FILE, DATE |
| BR-FRM-010 | Inactive forms must reject submissions with a 422 response                                                                            |
| BR-FRM-011 | Forms support soft delete with 30-day trash recovery                                                                                  |

### User Stories

| ID         | Story                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| US-FRM-001 | As an ADMIN, I want to create a contact form with name, email, and message fields so visitors can reach me                 |
| US-FRM-002 | As an EDITOR, I want to read new form submissions in the admin so I can respond to inquiries                               |
| US-FRM-003 | As an ADMIN, I want to receive an email when a form is submitted so I know when to check the admin                         |
| US-FRM-004 | As a Developer, I want the form submission endpoint to be public with CORS so my frontend can submit it without an API key |
| US-FRM-005 | As an ADMIN, I want to deactivate a form so it stops accepting submissions during maintenance                              |

### Acceptance Criteria

| ID         | Given                                     | When                                     | Then                                                                                                              |
| ---------- | ----------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| AC-FRM-001 | ADMIN creates contact form with 3 fields  | Form saved                               | Form record created with slug. Fields saved with positions.                                                       |
| AC-FRM-002 | Visitor submits contact form              | POST /api/v1/forms/contact/submit called | FormSubmission record created. Email queued in kast.email. form.submitted webhook fired. 201 returned to visitor. |
| AC-FRM-003 | Same IP submits form 11 times in 1 minute | 11th attempt                             | 429 RATE_LIMITED returned. Submission not saved.                                                                  |
| AC-FRM-004 | Form is inactive                          | Submission attempted                     | 422 "This form is no longer accepting submissions"                                                                |
| AC-FRM-005 | EDITOR opens unread submissions           | List loaded                              | Submissions sorted by date, unread count shown as badge on navigation                                             |
| AC-FRM-006 | Required field missing from submission    | POST submitted                           | 400 VALIDATION_ERROR with specific field name: "Field 'email' is required"                                        |
| AC-FRM-007 | Form submitted from disallowed origin     | CORS check                               | 403 CORS_ORIGIN_BLOCKED                                                                                           |

### Admin UI — Forms

Route: /admin/forms

- Form cards: name, slug, submission count, unread count badge, active toggle, Edit and View submissions buttons
- "Create Form" button

Form editor:

- Form name input
- Slug input (auto-generated, editable)
- Notification email input
- Active toggle
- Fields section (same drag-reorder as content type fields)
- Field types available for forms listed in BR-FRM-009

Submissions view (/admin/forms/:id/submissions):

- Table: Date, Fields preview (first 2-3 fields), Read status dot, IP address (truncated), Actions
- Unread submissions shown in bold
- Click row: slide-out panel with full submission data
- "Mark as read" action
- Filter: All / Unread / Read

### Error States

| ID         | Scenario                          | Behavior                                                                       |
| ---------- | --------------------------------- | ------------------------------------------------------------------------------ |
| ER-FRM-001 | Duplicate form slug               | 409 "A form with slug contact already exists"                                  |
| ER-FRM-002 | Invalid email in submission       | 400 "Invalid email format for field 'email'"                                   |
| ER-FRM-003 | Form not found by slug            | 404 — but do not reveal whether form exists if private (return generic 404)    |
| ER-FRM-004 | Notification email delivery fails | Logged to BullMQ dead-letter queue. Submission still saved. Admin not blocked. |
| ER-FRM-005 | File upload in form exceeds size  | 413 with size limits shown                                                     |
| ER-FRM-006 | Delete form with submissions      | 422 "Cannot delete form with 87 submissions. Export or trash it instead."      |

### Performance Requirements

| ID         | Requirement                        | Target                            |
| ---------- | ---------------------------------- | --------------------------------- |
| PF-FRM-001 | Form submission API response       | Under 200ms p95                   |
| PF-FRM-002 | Email notification queue           | Queued within 100ms of submission |
| PF-FRM-003 | Submission list load (100 records) | Under 400ms                       |

---

## 17. Menus and Navigation Module

### Overview

Provides named navigation menus with unlimited nesting. Menus can be locale-specific and can link to internal content entries or external URLs.

### Business Requirements

| ID         | Requirement                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| BR-MNU-001 | ADMIN and SUPER_ADMIN must be able to create named navigation menus with a slug identifier           |
| BR-MNU-002 | Menus can be locale-specific (a "main-nav" for EN and a different "main-nav" for AR)                 |
| BR-MNU-003 | Menu items must support unlimited nesting (parent/child tree)                                        |
| BR-MNU-004 | Menu items can link to: an absolute URL, or an internal ContentEntry (by ID)                         |
| BR-MNU-005 | Menu items support a target attribute (\_blank or \_self)                                            |
| BR-MNU-006 | Item position must be reorderable by drag-and-drop                                                   |
| BR-MNU-007 | The public delivery endpoint GET /api/v1/delivery/menus/:slug must return the full tree without auth |

### User Stories

| ID         | Story                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| US-MNU-001 | As an ADMIN, I want to create a main navigation menu so my frontend can render the site's nav without hardcoding links    |
| US-MNU-002 | As an ADMIN, I want to add a Blog submenu under the main navigation so the site structure is hierarchical                 |
| US-MNU-003 | As an ADMIN, I want to link a menu item to a content entry so if the entry's slug changes, the link updates automatically |
| US-MNU-004 | As a Developer, I want the menu API to return a full nested tree so my frontend renders the nav with one API call         |

### Acceptance Criteria

| ID         | Given                                            | When               | Then                                                            |
| ---------- | ------------------------------------------------ | ------------------ | --------------------------------------------------------------- |
| AC-MNU-001 | ADMIN creates "main-nav" menu                    | Menu saved         | Menu record with slug "main-nav" created                        |
| AC-MNU-002 | ADMIN adds "Blog" item with child "Latest Posts" | Items saved        | MenuItem tree with correct parentId. Position maintained.       |
| AC-MNU-003 | Menu item links to ContentEntry                  | Entry slug changes | Menu delivery API returns updated slug (resolved at query time) |
| AC-MNU-004 | GET /api/v1/delivery/menus/main-nav called       | No auth            | Returns full nested JSON tree with all active items             |

### Admin UI — Menus

Route: /admin/menus

- Menu cards: name, slug, locale, item count, Edit button
- "Create Menu" button

Menu editor (/admin/menus/:id):

- Left side: nested drag-drop tree of menu items
  - Item row: drag handle, label, URL or entry link indicator, active toggle, Edit and Delete buttons
  - Nested children indented with line connector
  - "Add item" button at end of each level
  - "Add child" button on each item
- Right side: Add/Edit item form
  - Label input
  - Link type radio: External URL / Internal Content Entry
  - If URL: URL input + Target dropdown
  - If Entry: content type dropdown + searchable entry picker
  - Active toggle
  - Save button

### Error States

| ID         | Scenario                                            | Behavior                                                    |
| ---------- | --------------------------------------------------- | ----------------------------------------------------------- |
| ER-MNU-001 | Duplicate menu slug                                 | 409 "A menu with slug main-nav already exists"              |
| ER-MNU-002 | Circular nesting (item A is child of its own child) | Prevented by UI — drag blocked. API returns 422.            |
| ER-MNU-003 | Linked entry is trashed                             | Warning badge on menu item: "Linked entry has been trashed" |
| ER-MNU-004 | Menu requested by non-existent slug                 | 404                                                         |

### Performance Requirements

| ID         | Requirement                          | Target         |
| ---------- | ------------------------------------ | -------------- |
| PF-MNU-001 | Menu delivery API (with Redis cache) | Under 30ms p95 |
| PF-MNU-002 | Menu editor load (50 items)          | Under 500ms    |

---

## 18. Global Settings Module

### Overview

Key-value store for site-wide configuration. Covers site identity, CORS origins, rate limits, media limits, SEO defaults, and other cross-cutting configuration.

### Business Requirements

| ID         | Requirement                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------ |
| BR-SET-001 | ADMIN and SUPER_ADMIN must be able to read all settings                                          |
| BR-SET-002 | SUPER_ADMIN must be able to update all settings. ADMIN can update non-security settings.         |
| BR-SET-003 | Settings must be grouped logically: site, seo, media, auth, email, cors, rateLimit               |
| BR-SET-004 | Settings marked isPublic=true must be available via the unauthenticated public delivery endpoint |
| BR-SET-005 | Security-sensitive settings (cors, auth, rateLimit) must only be editable by SUPER_ADMIN         |
| BR-SET-006 | All setting changes must be written to the audit log including before/after values               |
| BR-SET-007 | The system must load and cache settings at startup. Changes must invalidate the cache.           |

### Core Settings Reference

| Key                    | Group | Default        | Description                              |
| ---------------------- | ----- | -------------- | ---------------------------------------- |
| site.name              | site  | "My Kast Site" | Site display name                        |
| site.description       | site  | ""             | Site meta description                    |
| site.url               | site  | ""             | Public site URL (used in sitemap)        |
| site.logoUrl           | site  | null           | Logo media file URL                      |
| seo.defaultOgImageId   | seo   | null           | Default OG image for entries without one |
| seo.mcpEndpoint        | seo   | ""             | SEO MCP server URL for validation        |
| media.maxFileSizeMb    | media | 50             | Maximum upload size in MB                |
| media.allowedMimeTypes | media | [...defaults]  | Allowed file types array                 |
| auth.allowRegistration | auth  | false          | Allow public user registration           |
| cors.allowedOrigins    | cors  | ["*"]          | Allowed CORS origins                     |
| rateLimit.public.max   | cors  | 100            | Public endpoint rate limit per minute    |
| rateLimit.forms.max    | cors  | 10             | Form submission rate limit per minute    |
| email.fromAddress      | email | ""             | From address for system emails           |
| email.fromName         | email | "Kast CMS"     | From name for system emails              |

### Admin UI — Settings

Route: /admin/settings

Tab navigation: Site, SEO, Media, Auth, Email, Security, Locales, Roles

Each tab shows grouped settings with:

- Setting label + description
- Appropriate input type (text, number, toggle, multi-select, JSON)
- Current value
- "Save changes" button at bottom of tab

Security tab (SUPER_ADMIN only):

- CORS origins (multi-input: add/remove origins)
- Rate limit inputs (per group)
- Note: "Changes take effect immediately. Incorrect CORS settings may lock you out."

### Error States

| ID         | Scenario                          | Behavior                                                      |
| ---------- | --------------------------------- | ------------------------------------------------------------- |
| ER-SET-001 | ADMIN tries to edit CORS settings | 403 "Only Super Admin can modify security settings"           |
| ER-SET-002 | Invalid CORS origin format        | Inline: "Must be a valid URL or \* (e.g. https://mysite.com)" |
| ER-SET-003 | Setting value wrong type          | 400 with specific type error                                  |
| ER-SET-004 | Rate limit set to 0               | Validation: "Rate limit must be at least 1"                   |
| ER-SET-005 | max file size set to 0            | Validation: "File size must be greater than 0"                |

### Performance Requirements

| ID         | Requirement                          | Target                       |
| ---------- | ------------------------------------ | ---------------------------- |
| PF-SET-001 | Settings load (cached)               | Under 10ms p99 (Redis cache) |
| PF-SET-002 | Settings save and cache invalidation | Under 300ms                  |

---

## 19. Audit Log Module

### Overview

Every mutation in Kast is recorded in an immutable audit log. The audit log cannot be edited or deleted. It supports filtering, export, and agent attribution.

### Business Requirements

| ID         | Requirement                                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| BR-AUD-001 | ADMIN and SUPER_ADMIN must be able to read audit logs                                                                                   |
| BR-AUD-002 | Audit logs must capture: actor (userId or agentTokenId), action, resource, resourceId, before state, after state, IP address, timestamp |
| BR-AUD-003 | Agent actions must be tagged with agentTokenId and agentName (e.g. "claude-sonnet-4")                                                   |
| BR-AUD-004 | MCP dry-run operations must be logged with isDryRun=true                                                                                |
| BR-AUD-005 | Sensitive fields (passwordHash, tokenHash, secretHash) must be redacted before storing in before/after snapshots                        |
| BR-AUD-006 | Audit logs must be immutable — no update or delete endpoints exist                                                                      |
| BR-AUD-007 | The audit log API must support filtering by user, agent, resource, action, date range, and isDryRun                                     |
| BR-AUD-008 | Export to CSV and JSON must be available                                                                                                |
| BR-AUD-009 | Audit log writes go through BullMQ kast.audit queue for high-throughput operations                                                      |

### User Stories

| ID         | Story                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| US-AUD-001 | As a SUPER_ADMIN, I want to see a log of all admin actions so I can investigate what changed and who changed it    |
| US-AUD-002 | As a SUPER_ADMIN, I want to filter the audit log by AI agent so I can see exactly what Claude did during a session |
| US-AUD-003 | As a SUPER_ADMIN, I want to export audit logs as CSV so I can analyze them in a spreadsheet                        |
| US-AUD-004 | As an ADMIN, I want to see the before and after state of a content change so I know what was modified              |

### Acceptance Criteria

| ID         | Given                                    | When                     | Then                                                                                             |
| ---------- | ---------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------ |
| AC-AUD-001 | EDITOR publishes a content entry         | Publish completes        | AuditLog record created: action=content.publish, before={status:DRAFT}, after={status:PUBLISHED} |
| AC-AUD-002 | AI agent publishes via MCP               | Tool executes            | AuditLog created with agentTokenId set, agentName="claude-sonnet-4"                              |
| AC-AUD-003 | AI agent calls dry-run publish           | Preview returned         | AuditLog created with isDryRun=true — no actual publish                                          |
| AC-AUD-004 | ADMIN views audit log                    | Filtered by agentTokenId | Only entries where that agent is the actor are shown                                             |
| AC-AUD-005 | User changes their password              | Change saved             | AuditLog created — before and after show **_REDACTED_** for passwordHash                         |
| AC-AUD-006 | ADMIN tries to delete an audit log entry | DELETE request sent      | 405 Method Not Allowed — endpoint does not exist                                                 |

### Admin UI — Audit Log

Route: /admin/audit

Layout:

- Filter bar:
  - Search (full-text)
  - Actor type: All / Human / AI Agent
  - User dropdown (searchable)
  - Resource dropdown (ContentEntry, MediaFile, User, etc.)
  - Action input
  - Date range picker
  - isDryRun toggle (show only dry-runs)
- Table:
  - Timestamp (relative + absolute on hover)
  - Actor (avatar + name for humans, robot icon + agent name for AI)
  - Action badge (color-coded: green=create, blue=update, orange=delete, red=auth)
  - Resource + Resource ID
  - IP address
  - Expand arrow (shows before/after diff)
- Row expanded state: side-by-side diff of before/after JSON with changed fields highlighted
- "Export" button: dropdown CSV / JSON
- Pagination

### Error States

| ID         | Scenario                    | Behavior                                                                                                      |
| ---------- | --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| ER-AUD-001 | Export with >10000 records  | Warning: "Export contains 12,450 records. Large exports may take up to 30 seconds." Progress indicator shown. |
| ER-AUD-002 | Audit write queue backed up | Logged at warning level. Admin notified via health endpoint degraded status.                                  |

### Performance Requirements

| ID         | Requirement                              | Target              |
| ---------- | ---------------------------------------- | ------------------- |
| PF-AUD-001 | Audit log list (20 records with filters) | Under 500ms         |
| PF-AUD-002 | Audit write (via BullMQ)                 | Under 50ms to queue |
| PF-AUD-003 | CSV export (10000 records)               | Under 30 seconds    |

---

## 20. Trash and Recovery Module

### Overview

Soft-deleted records are moved to trash rather than permanently deleted. ADMIN and SUPER_ADMIN can restore items. BullMQ permanently deletes items after 30 days.

### Business Requirements

| ID         | Requirement                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| BR-TRS-001 | The following resources support trash: ContentEntry, MediaFile, User, Form                             |
| BR-TRS-002 | Trashed items must show a permanentDeleteAt timestamp (trashedAt + 30 days)                            |
| BR-TRS-003 | BullMQ kast.trash queue must run a daily cleanup and permanently delete items past their 30-day window |
| BR-TRS-004 | Only ADMIN and SUPER_ADMIN can restore trashed items                                                   |
| BR-TRS-005 | Only SUPER_ADMIN can permanently delete an item before the 30-day window                               |
| BR-TRS-006 | Trashed items must be excluded from all public delivery API results                                    |
| BR-TRS-007 | Trashed items must be visible in admin with a "Trashed" status filter                                  |
| BR-TRS-008 | All trash and restore actions must be written to the audit log                                         |

### User Stories

| ID         | Story                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| US-TRS-001 | As an ADMIN, I want to restore a content entry that was accidentally trashed so I do not lose important content   |
| US-TRS-002 | As a SUPER_ADMIN, I want to permanently delete a user account immediately so GDPR deletion requests are satisfied |
| US-TRS-003 | As an ADMIN, I want to see when an item will be permanently deleted so I know how long I have to restore it       |

### Acceptance Criteria

| ID         | Given                                               | When                       | Then                                                                                                              |
| ---------- | --------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| AC-TRS-001 | EDITOR trashes a content entry                      | Trash confirmed            | ContentEntry.trashedAt set. Entry hidden from delivery API. Entry visible in admin with "Trashed" status.         |
| AC-TRS-002 | ADMIN restores the entry                            | Restore confirmed          | ContentEntry.trashedAt set to null. Entry status returns to DRAFT. Audit log records restore with restoring user. |
| AC-TRS-003 | Item trashedAt is 31 days ago                       | BullMQ kast.trash job runs | Item permanently deleted from database. Audit log records permanent deletion by system.                           |
| AC-TRS-004 | SUPER_ADMIN permanently deletes item before 30 days | Delete confirmed           | Item permanently deleted immediately. Audit log records deletion by SUPER_ADMIN.                                  |
| AC-TRS-005 | EDITOR tries to restore trashed item                | Restore attempted          | 403 "Only Admin or Super Admin can restore trashed items"                                                         |

### Admin UI — Trash

Route: /admin/trash

Layout:

- Resource type filter: All / Content Entries / Media Files / Users / Forms
- Table: Resource type badge, Name/title, Trashed by, Trashed date, "Permanently deleted in X days" countdown, Restore button, Permanent delete button (SUPER_ADMIN only, red)
- Confirmation modal for permanent delete: "This cannot be undone. Type DELETE to confirm."

### Error States

| ID         | Scenario                                                   | Behavior                                                                            |
| ---------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| ER-TRS-001 | Restore media file that is now referenced by trashed entry | Restore succeeds for file. Note shown: "The entry using this file is also trashed." |
| ER-TRS-002 | Permanent delete a SUPER_ADMIN user                        | 422 "Super Admin accounts cannot be permanently deleted"                            |
| ER-TRS-003 | Trash cleanup job fails                                    | Error logged, retry scheduled. Item not permanently deleted until job succeeds.     |

### Performance Requirements

| ID         | Requirement                     | Target          |
| ---------- | ------------------------------- | --------------- |
| PF-TRS-001 | Trash list load                 | Under 400ms     |
| PF-TRS-002 | Restore operation               | Under 300ms     |
| PF-TRS-003 | BullMQ cleanup job (1000 items) | Under 2 minutes |

---

## 21. MCP Server and AI Agents Module

### Overview

Every Kast installation ships with a built-in MCP server at /mcp. AI agents (Claude, Cursor, any MCP client) connect to it using agent tokens. Every operation supports dry-run mode and is fully audited.

### Business Requirements

| ID         | Requirement                                                                                |
| ---------- | ------------------------------------------------------------------------------------------ |
| BR-MCP-001 | The MCP server must be available at /mcp on every Kast installation                        |
| BR-MCP-002 | Authentication must use agent tokens (kastagent\_...) with JSON scope objects              |
| BR-MCP-003 | The MCP server must expose exactly 15 tools (see tool list in Business Requirements below) |
| BR-MCP-004 | Every tool must support a dryRun=true parameter that previews without applying             |
| BR-MCP-005 | Every tool call must be written to AuditLog with agentTokenId and agentName                |
| BR-MCP-006 | Tool calls outside the agent token's scope must return SCOPE_DENIED                        |
| BR-MCP-007 | ADMIN and SUPER_ADMIN must be able to create, view, and revoke agent tokens                |
| BR-MCP-008 | Agent session history must be queryable per token                                          |
| BR-MCP-009 | The MCP server must expose Agent Skills metadata describing all available operations       |

Required MCP tools:

- kast_content_list
- kast_content_create
- kast_content_update
- kast_content_publish
- kast_content_unpublish
- kast_schema_create_type
- kast_schema_add_field
- kast_seo_validate
- kast_plugin_install
- kast_plugin_enable
- kast_plugin_disable
- kast_media_upload
- kast_redirect_create
- kast_user_create
- kast_audit_log

### User Stories

| ID         | Story                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| US-MCP-001 | As a Developer, I want to connect Claude.ai to my Kast installation via MCP so I can manage content by talking to Claude |
| US-MCP-002 | As a Developer, I want to give Claude a scoped token so it can only publish content but not install plugins              |
| US-MCP-003 | As an ADMIN, I want to see every action Claude took in the audit log so I can verify its changes                         |
| US-MCP-004 | As a Developer, I want Claude to preview changes before applying them (dry-run) so I can approve before committing       |
| US-MCP-005 | As a Developer, I want to revoke an agent token immediately so I can stop an AI agent from making changes                |

### Acceptance Criteria

| ID         | Given                                             | When                             | Then                                                                                                                               |
| ---------- | ------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| AC-MCP-001 | Developer connects Claude.ai to Kast MCP at /mcp  | Claude calls kast_content_list   | List of entries returned. AgentSession record created.                                                                             |
| AC-MCP-002 | Agent token has scope {content: ["read"]}         | Agent calls kast_content_publish | SCOPE_DENIED returned. Publish not attempted. Audit log records the denied attempt.                                                |
| AC-MCP-003 | Agent calls kast_content_publish with dryRun=true | Tool executes                    | Preview returned: {wouldPublish: "entry-id", seoScore: 78, warnings: [...]}. Entry NOT published. Audit log records isDryRun=true. |
| AC-MCP-004 | Agent calls kast_plugin_install                   | Scope includes plugins:install   | Plugin install initiated. Agent session records tool call.                                                                         |
| AC-MCP-005 | ADMIN revokes an agent token                      | Revoke confirmed                 | Token marked revoked. Immediately rejected on next use.                                                                            |
| AC-MCP-006 | Agent calls kast_audit_log                        | Scope includes audit:read        | Returns recent audit log entries filtered by what agent has access to view                                                         |

### Admin UI — Agent Tokens

Route: /admin/settings/agent-tokens

- Table: Name, Prefix (kast...), Created date, Last used, Revoke button
- "Create Agent Token" button

Create agent token modal:

- Name input (e.g. "Claude Dev Agent")
- Scope builder:
  - Resource list with checkboxes per action
  - Visual permission matrix
- "Create token" button
- Result screen: Shows full token ONCE with copy button, warning "Save this token now — it will not be shown again."

Agent token detail (click row):

- Name, prefix, created date
- Scope JSON display
- Session history: table of sessions with tools used and timestamps
- "Revoke token" danger button

### Error States

| ID         | Scenario                                | Behavior                                                       |
| ---------- | --------------------------------------- | -------------------------------------------------------------- |
| ER-MCP-001 | Invalid or revoked agent token          | 401 UNAUTHORIZED                                               |
| ER-MCP-002 | Tool not in agent scope                 | 403 SCOPE_DENIED with specific resource and action             |
| ER-MCP-003 | Agent calls non-existent tool           | 404 TOOL_NOT_FOUND                                             |
| ER-MCP-004 | MCP server receives malformed tool call | 400 VALIDATION_ERROR with parameter list                       |
| ER-MCP-005 | Dry-run of destructive operation        | Always succeeds with preview — never returns error for dry-run |
| ER-MCP-006 | Agent rate limited                      | 429 with retryAfter header                                     |

### Performance Requirements

| ID         | Requirement                               | Target          |
| ---------- | ----------------------------------------- | --------------- |
| PF-MCP-001 | MCP tool response time (read operations)  | Under 200ms p95 |
| PF-MCP-002 | MCP tool response time (write operations) | Under 500ms p95 |
| PF-MCP-003 | Agent session log write                   | Under 50ms      |
| PF-MCP-004 | Token validation                          | Under 5ms       |

---

## 22. Queue System — BullMQ

### Overview

BullMQ is the background processing backbone of Kast. All operations that take more than 100ms, need retry logic, or should not block HTTP responses go through a named queue.

### Business Requirements

| ID         | Requirement                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| BR-QUE-001 | The system must maintain 6 named BullMQ queues: kast.webhook, kast.media, kast.seo, kast.publish, kast.audit, kast.email |
| BR-QUE-002 | Each queue must have a dead-letter queue (DLQ) for jobs that exhaust all retries                                         |
| BR-QUE-003 | Failed jobs must be retried with exponential backoff: 1min, 5min, 30min, 2hr, 24hr                                       |
| BR-QUE-004 | Queue health must be exposed in the /health endpoint                                                                     |
| BR-QUE-005 | Queue monitoring UI (Bull Board) must be available in the admin at /admin/settings/queues (SUPER_ADMIN only)             |
| BR-QUE-006 | Scheduled publish jobs (kast.publish) must use BullMQ delayed jobs                                                       |
| BR-QUE-007 | The trash cleanup job must run daily via BullMQ repeatable job                                                           |

### Admin UI — Queue Monitor

Route: /admin/settings/queues (SUPER_ADMIN only)

- Per-queue cards:
  - Queue name, status (healthy/degraded)
  - Waiting count, Active count, Completed count, Failed count
  - "Retry failed jobs" button
  - "Clear completed" button
- Failed jobs list (expandable per queue):
  - Job ID, job data (truncated), failure reason, attempt count, next retry time
  - "Retry now" button per job
  - "Discard" button per job

### Error States

| ID         | Scenario                    | Behavior                                                                  |
| ---------- | --------------------------- | ------------------------------------------------------------------------- |
| ER-QUE-001 | Redis unavailable           | All queues stop. Health endpoint returns degraded. Critical alert logged. |
| ER-QUE-002 | Job exceeds max retries     | Moved to DLQ. Logged as error. Visible in queue monitor.                  |
| ER-QUE-003 | BullMQ worker process crash | Jobs return to queue automatically on next worker restart.                |

### Performance Requirements

| ID         | Requirement                      | Target        |
| ---------- | -------------------------------- | ------------- |
| PF-QUE-001 | Job queue time (event to BullMQ) | Under 100ms   |
| PF-QUE-002 | Queue monitor data load          | Under 500ms   |
| PF-QUE-003 | Redis connection latency         | Under 2ms p99 |

---

## 23. Health and Monitoring

### Overview

The health endpoint exposes system status for load balancers, monitoring tools, and the admin dashboard.

### Business Requirements

| ID         | Requirement                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| BR-HLT-001 | GET /api/v1/health must return 200 when all services healthy, 503 when any service is degraded             |
| BR-HLT-002 | The health endpoint must check: PostgreSQL connectivity, Redis connectivity, storage provider connectivity |
| BR-HLT-003 | The health endpoint must be public (no auth, CORS exempt)                                                  |
| BR-HLT-004 | The health endpoint must respond within 1 second or itself return a timeout error                          |
| BR-HLT-005 | The admin dashboard must display system health at a glance                                                 |
| BR-HLT-006 | OpenTelemetry integration must be available via the Sentry plugin                                          |

### Admin UI — Dashboard

Route: /admin (the home screen)

Layout:

- System health widget: green/yellow/red indicator for Database, Redis, Storage, Queue
- Content overview: total entries per content type with status breakdown
- Recent activity feed: last 10 audit log entries (actor, action, resource, time)
- Queue status: pending job counts per queue
- Quick actions: "New Entry" shortcuts per content type

### Error States

| ID         | Scenario                         | Behavior                                                    |
| ---------- | -------------------------------- | ----------------------------------------------------------- |
| ER-HLT-001 | PostgreSQL unreachable           | 503 returned with services.database=error                   |
| ER-HLT-002 | Redis unreachable                | 503 with services.redis=error. BullMQ and caching affected. |
| ER-HLT-003 | Storage provider check times out | 503 with services.storage=error                             |
| ER-HLT-004 | Health check itself exceeds 1s   | 503 with message "Health check timed out"                   |

### Performance Requirements

| ID         | Requirement              | Target          |
| ---------- | ------------------------ | --------------- |
| PF-HLT-001 | Health endpoint response | Under 200ms p99 |
| PF-HLT-002 | Dashboard load           | Under 1s        |

## 24. Performance Requirements

### Overview

These are system-wide performance budgets. Individual module targets are listed per-module above. This section defines the global SLA.

### API Response Time SLAs

| Endpoint Type                   | p50    | p95    | p99     |
| ------------------------------- | ------ | ------ | ------- |
| Delivery API (public, cached)   | <20ms  | <50ms  | <100ms  |
| Delivery API (public, uncached) | <100ms | <200ms | <400ms  |
| Admin API (read operations)     | <100ms | <300ms | <500ms  |
| Admin API (write operations)    | <150ms | <400ms | <800ms  |
| Auth (login/refresh)            | <200ms | <500ms | <1000ms |
| File upload (metadata creation) | <200ms | <500ms | <1000ms |
| Health check                    | <50ms  | <200ms | <500ms  |

### Admin UI Performance Budgets

| Metric                          | Target                      |
| ------------------------------- | --------------------------- |
| Largest Contentful Paint (LCP)  | Under 2.5s on 4G connection |
| First Contentful Paint (FCP)    | Under 1.5s                  |
| Cumulative Layout Shift (CLS)   | Under 0.1                   |
| Interaction to Next Paint (INP) | Under 200ms                 |
| Time to Interactive (TTI)       | Under 3.5s                  |
| Admin JS bundle size (gzipped)  | Under 300KB                 |

### Background Job SLAs

| Queue                          | Expected completion time            |
| ------------------------------ | ----------------------------------- |
| kast.webhook (single delivery) | Under 5 seconds                     |
| kast.media (image processing)  | Under 10 seconds                    |
| kast.seo (validation)          | Under 10 seconds                    |
| kast.publish (scheduled)       | Within 60 seconds of scheduled time |
| kast.email (transactional)     | Under 30 seconds                    |
| kast.audit (log write)         | Under 1 second                      |

### Scalability Targets (v1 baseline)

| Metric                           | Target                                   |
| -------------------------------- | ---------------------------------------- |
| Concurrent admin users           | 50 without degradation                   |
| Content entries per installation | 100,000 without pagination issues        |
| API requests per minute          | 1,000 on a single VPS (2 CPU, 4GB RAM)   |
| Media files per installation     | 10,000 without media library slowdown    |
| Audit log entries                | 1,000,000 with filters still under 500ms |

### Caching Strategy

| Resource               | Cache Location              | TTL                   |
| ---------------------- | --------------------------- | --------------------- |
| Delivery API responses | Redis                       | 60 seconds            |
| Sitemap XML            | Redis                       | 10 minutes            |
| Menu trees             | Redis                       | 5 minutes             |
| Public settings        | Redis                       | 5 minutes             |
| Redirect rules         | Redis                       | 10 minutes            |
| JWT verification       | In-memory (no cache needed) | N/A                   |
| Settings (all)         | In-memory (app startup)     | Invalidated on change |

---

## 25. Accessibility Requirements

### Standards

All admin UI pages must conform to WCAG 2.1 Level AA.

### Specific Requirements

| ID      | Requirement                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------ |
| ACC-001 | All interactive elements must be keyboard navigable (Tab, Enter, Space, Escape, Arrow keys)            |
| ACC-002 | All images and icons must have descriptive alt text or aria-label                                      |
| ACC-003 | Color must not be the only means of conveying information (status badges must also have text or icons) |
| ACC-004 | Minimum contrast ratio: 4.5:1 for normal text, 3:1 for large text                                      |
| ACC-005 | Focus indicators must be visible on all interactive elements                                           |
| ACC-006 | Form inputs must have associated labels (not just placeholders)                                        |
| ACC-007 | Error messages must be associated with their field via aria-describedby                                |
| ACC-008 | Toast notifications must be announced by screen readers via aria-live                                  |
| ACC-009 | Modal dialogs must trap focus and restore on close                                                     |
| ACC-010 | Rich text editor must support keyboard-only editing                                                    |
| ACC-011 | Drag-and-drop interfaces (field reordering, menu builder) must have keyboard alternatives              |
| ACC-012 | All admin UI pages must have logical heading hierarchy (h1 > h2 > h3)                                  |

---

## 26. Future Considerations v2 and v3

### v2 (6-12 months after v1)

| Feature                 | Description                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| Commerce module         | Products, variants, inventory, carts, orders, checkout, Stripe + PayPal payment adapters      |
| Page builder            | Block/section editor for building pages without code                                          |
| Scheduled publishing    | Already in schema — UI and BullMQ integration ships v1. Full scheduling calendar UI ships v2. |
| AI content drafting     | Admin UI for generating content fields using Claude API                                       |
| AI image alt-text       | Automatic alt text generation on media upload                                                 |
| AI migration assistant  | Import content from WordPress, Ghost, Blogger via AI-assisted field mapping                   |
| GraphQL subscriptions   | Real-time content updates via WebSocket                                                       |
| Team collaboration      | Simultaneous editing indicators, entry locking, inline comments                               |
| Visual content modeling | Drag-and-drop schema builder as alternative to the current form-based builder                 |
| SQLite support          | Local dev without Docker (for simplest possible setup)                                        |
| Plugin marketplace      | Community plugin registry with search, reviews, verified badges                               |

### v3 (12+ months)

| Feature             | Description                                                        |
| ------------------- | ------------------------------------------------------------------ |
| Multi-tenancy       | Single Kast installation hosting multiple isolated projects        |
| Kast Cloud          | Managed hosting product (like Strapi Cloud)                        |
| Enterprise features | SSO (SAML, LDAP), audit log retention policies, SLA support        |
| Serverless profile  | Cloudflare Workers + D1 + R2 deployment target                     |
| White-label mode    | Custom branding, custom domain for admin, agency reseller features |
| Mobile app          | iOS and Android companion app for editors                          |
| AI schema designer  | Describe your content in plain English, Kast designs the schema    |

---

## 27. Success Metrics

### v1 Launch Success

| Metric                             | Target                                       | Measurement                      |
| ---------------------------------- | -------------------------------------------- | -------------------------------- |
| Time to first working CMS          | Under 5 minutes from npx create-kast-app     | User testing with 10 developers  |
| API response time SLA met          | 99% of admin API calls under 400ms p95       | Production monitoring            |
| Zero critical security issues      | Security audit passes all 25 checklist items | KAST_SECURITY_MODEL.md checklist |
| Test coverage                      | Services >= 80%, Controllers >= 60%          | Jest coverage report             |
| Admin UI accessibility             | WCAG 2.1 AA on all 18 module screens         | Automated + manual audit         |
| GitHub stars at 1 month            | 500+                                         | GitHub metrics                   |
| GitHub issues closed within 7 days | 80% of bug reports                           | GitHub metrics                   |

### Developer Experience Metrics

| Metric                                                | Target                                       |
| ----------------------------------------------------- | -------------------------------------------- |
| Time to create a content type and publish first entry | Under 10 minutes without documentation       |
| Time to connect Claude.ai to Kast MCP                 | Under 5 minutes with docs                    |
| SDK type-safety errors in CI                          | Zero — all field types correct by default    |
| Plugin development to first working plugin            | Under 2 hours with @kast/plugin-sdk and docs |

### Editor Experience Metrics

| Metric                                          | Target                                         |
| ----------------------------------------------- | ---------------------------------------------- |
| Time to publish a new blog post (draft to live) | Under 3 minutes for a trained editor           |
| SEO score improvement after validation guidance | Minimum 20-point improvement on average        |
| RTL admin UI satisfaction                       | All Arabic interface elements render correctly |

---

## Document Control

| Version | Date       | Author       | Changes                  |
| ------- | ---------- | ------------ | ------------------------ |
| 0.1     | April 2026 | Oday Bakkour | Initial draft            |
| 1.0     | April 2026 | Oday Bakkour | Complete v1 requirements |

### References

- KAST_VISION.md — product vision, positioning, ecosystem
- KAST_DATABASE_SCHEMA.md — all 38 Prisma models
- KAST_API_SPEC.md — all 107 REST endpoints
- KAST_SECURITY_MODEL.md — RBAC matrix, token design, security checklist
- KAST_DEV_STANDARDS.md — TypeScript, ESLint, git, testing standards

---

_Document version: 1.0_
_Last updated: April 2026_
_Status: Draft — In Review_
_Modules covered: 18 | Requirements: 180+ BR/US/AC | Error states: 100+ | Performance targets: 60+_

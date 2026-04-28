# KAST CMS — REST API Specification

### _Every endpoint. Every shape. Every example._

> API Version: v1 | Base URL: `/api/v1` | Format: JSON | Security: 3-layer (CORS → Rate Limit → Auth)

---

## Table of Contents

1. [Global Conventions](#1-global-conventions)
2. [Authentication](#2-authentication)
3. [Content Types API](#3-content-types-api)
4. [Content Entries API](#4-content-entries-api)
5. [Content Delivery API (Public)](#5-content-delivery-api-public)
6. [SEO API](#6-seo-api)
7. [Media API](#7-media-api)
8. [Users API](#8-users-api)
9. [Roles & Permissions API](#9-roles--permissions-api)
10. [API Tokens API](#10-api-tokens-api)
11. [Agent Tokens API](#11-agent-tokens-api)
12. [Locales API](#12-locales-api)
13. [Webhooks API](#13-webhooks-api)
14. [Plugins API](#14-plugins-api)
15. [Forms API](#15-forms-api)
16. [Menus API](#16-menus-api)
17. [Settings API](#17-settings-api)
18. [Audit API](#18-audit-api)
19. [Trash API](#19-trash-api)
20. [Health API](#20-health-api)

---

## 1. Global Conventions

### Base URL

```
/api/v1
```

### Authentication

All protected endpoints require:

```
Authorization: Bearer <token>
```

Token can be a JWT access token, an API token (`kast_...`), or an agent token (`kastagent_...`).

Public content endpoints optionally accept a read-only API key:

```
X-Kast-Key: kast_readonly_...
```

When a valid key is present: CORS origin check is bypassed and the rate limit ceiling is raised. This is the pattern for server-side rendering (Next.js SSR, mobile apps) where the caller is trusted infrastructure, not a browser.

---

### 3-Layer Security Model

Every request — including public ones — passes through three independent layers in order:

```
Incoming Request
      ↓
┌─────────────────────────────────────────┐
│  Layer 1: CORS                          │
│  Is this origin allowed to call us?     │
│  Configured in GlobalSettings.          │
│  Sitemap + Health are exempt.           │
└──────────────────┬──────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│  Layer 2: Rate Limiting                 │
│  Is this caller going too fast?         │
│  Always on. Thresholds are configurable │
│  in GlobalSettings.                     │
└──────────────────┬──────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│  Layer 3: Auth                          │
│  Who is this caller?                    │
│  JWT / API token / Agent token.         │
│  Public endpoints skip this layer       │
│  unless X-Kast-Key is provided.         │
└──────────────────┬──────────────────────┘
                   ↓
              Route Handler
```

#### Layer 1 — CORS

| Setting                 | Default                           | Description                                                         |
| ----------------------- | --------------------------------- | ------------------------------------------------------------------- |
| `cors.allowedOrigins`   | `["*"]` in dev, `[]` in prod      | Allowed origins. `["*"]` = open. Lock to your domain in production. |
| `cors.allowedMethods`   | `["GET","POST","PATCH","DELETE"]` | Allowed HTTP methods                                                |
| `cors.allowCredentials` | `true`                            | Allow cookies and auth headers                                      |

Configured via `GlobalSettings` key `cors.*` or env vars. CORS is **always enabled** — it is never possible to turn it off entirely.

**Sitemap and Health** are CORS-exempt by design. Search engine bots and monitoring services must always reach them.

#### Layer 2 — Rate Limiting

Rate limiting is **always on**. Only the thresholds are configurable.

| Caller type         | Window | Default max | Config key             |
| ------------------- | ------ | ----------- | ---------------------- |
| Public IP (no key)  | 1 min  | 100 req     | `rateLimit.public.max` |
| Valid `X-Kast-Key`  | 1 min  | 1000 req    | `rateLimit.apiKey.max` |
| Form submission IP  | 1 min  | 10 req      | `rateLimit.forms.max`  |
| Auth endpoints      | 15 min | 20 req      | `rateLimit.auth.max`   |
| Authenticated admin | 1 min  | 300 req     | `rateLimit.admin.max`  |

On limit exceeded: `429 RATE_LIMITED` with `Retry-After` header.

#### Layer 3 — Auth

| Endpoint type                        | Behavior                                                   |
| ------------------------------------ | ---------------------------------------------------------- |
| Protected (`🔑` `👁` `✏️` `🛡` `👑`) | JWT or API token required. Rejected with `401` if missing. |
| Public (`🌐`) without key            | Layers 1 + 2 only. No auth check.                          |
| Public (`🌐`) with `X-Kast-Key`      | Key validated. CORS bypassed. Higher rate limit applied.   |

---

### Role Hierarchy

```
SUPER_ADMIN > ADMIN > EDITOR > VIEWER
```

### Endpoint Legend

| Symbol | Meaning                                                                    |
| ------ | -------------------------------------------------------------------------- |
| 🌐     | Public — CORS + rate limit only. Optional `X-Kast-Key` for server callers. |
| 🌐❌   | Fully open — CORS exempt. Sitemap and health only.                         |
| 🔑     | Any authenticated user                                                     |
| 👁     | VIEWER or above                                                            |
| ✏️     | EDITOR or above                                                            |
| 🛡     | ADMIN or above                                                             |
| 👑     | SUPER_ADMIN only                                                           |

---

### Response Envelope

**Single resource:**

```json
{
  "data": {}
}
```

**List:**

```json
{
  "data": [],
  "meta": {
    "total": 100,
    "limit": 20,
    "cursor": "clxyz123...",
    "hasNextPage": true
  }
}
```

**Error:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Content entry not found",
    "statusCode": 404,
    "timestamp": "2026-04-22T10:00:00.000Z",
    "path": "/api/v1/content/blog-post/abc123"
  }
}
```

---

### Cursor Pagination

All list endpoints accept:

| Query param | Type            | Default | Description                               |
| ----------- | --------------- | ------- | ----------------------------------------- |
| `limit`     | number          | `20`    | Items per page. Max `100`                 |
| `cursor`    | string          | —       | Opaque cursor from previous `meta.cursor` |
| `order`     | `asc` \| `desc` | `desc`  | Sort by `createdAt`                       |

---

### Standard Error Codes

| HTTP | Code                  | When                                                            |
| ---- | --------------------- | --------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`    | Invalid request body or query params                            |
| 401  | `UNAUTHORIZED`        | Missing or invalid token                                        |
| 403  | `FORBIDDEN`           | Token valid but insufficient role                               |
| 403  | `CORS_ORIGIN_BLOCKED` | Request origin not in `cors.allowedOrigins` — Layer 1 rejection |
| 404  | `NOT_FOUND`           | Resource does not exist                                         |
| 409  | `CONFLICT`            | Unique constraint violation (e.g. duplicate slug)               |
| 422  | `UNPROCESSABLE`       | Business rule violation (e.g. publish with missing SEO)         |
| 429  | `RATE_LIMITED`        | Too many requests. `Retry-After` header included                |
| 500  | `INTERNAL_ERROR`      | Unexpected server error                                         |
| 503  | `SERVICE_UNAVAILABLE` | Downstream service (SEO MCP, storage) unreachable               |

**Rate limit response headers on every request:**

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1745320800
Retry-After: 42        ← only on 429
```

---

## 2. Authentication

### POST /api/v1/auth/login 🌐

Authenticate with email and password. Returns access + refresh tokens.

**Request body:**

```ts
{
  email: string;
  password: string;
}
```

**Response `200`:**

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5...",
    "expiresIn": 900,
    "user": {
      "id": "clxyz123",
      "email": "oday@kastcms.com",
      "firstName": "Oday",
      "lastName": "Bakkour",
      "avatarUrl": null,
      "roles": ["ADMIN"]
    }
  }
}
```

**Errors:** `400` `401`

---

### POST /api/v1/auth/refresh 🌐

Exchange a refresh token for a new access token.

**Request body:**

```ts
{
  refreshToken: string;
}
```

**Response `200`:**

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5...",
    "expiresIn": 900
  }
}
```

**Errors:** `401`

---

### POST /api/v1/auth/logout 🔑

Revoke the current refresh token.

**Request body:**

```ts
{
  refreshToken: string;
}
```

**Response `204`:** No content.

---

### GET /api/v1/auth/me 🔑

Get the currently authenticated user's profile.

**Response `200`:**

```json
{
  "data": {
    "id": "clxyz123",
    "email": "oday@kastcms.com",
    "firstName": "Oday",
    "lastName": "Bakkour",
    "avatarUrl": null,
    "isVerified": true,
    "roles": ["ADMIN"],
    "lastLoginAt": "2026-04-22T09:00:00.000Z",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

---

### PATCH /api/v1/auth/me 🔑

Update the authenticated user's own profile.

**Request body:**

```ts
{
  firstName?: string
  lastName?: string
  avatarUrl?: string
  currentPassword?: string   // required if changing password
  newPassword?: string
}
```

**Response `200`:** Updated user object (same shape as `GET /auth/me`).

**Errors:** `400` `401`

---

### POST /api/v1/auth/forgot-password 🌐

Send a password reset email.

**Request body:**

```ts
{
  email: string;
}
```

**Response `200`:**

```json
{
  "data": {
    "message": "If this email exists, a reset link has been sent."
  }
}
```

> Always returns 200 — never reveals whether the email exists.

---

### POST /api/v1/auth/reset-password 🌐

Reset password using a token from the reset email.

**Request body:**

```ts
{
  token: string;
  password: string;
}
```

**Response `200`:** Same shape as login response.

**Errors:** `400` `401`

---

### GET /api/v1/auth/oauth/:provider 🌐

Redirect to OAuth provider. Supported: `google`, `github`.

**Response `302`:** Redirect to provider.

---

### GET /api/v1/auth/oauth/:provider/callback 🌐

OAuth callback. Completes login and returns tokens.

**Response `200`:** Same shape as login response.

---

## 3. Content Types API

### GET /api/v1/content-types 👁

List all content types.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `limit` | number | Default `50` |
| `cursor` | string | Pagination cursor |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clxyz123",
      "name": "blog-post",
      "displayName": "Blog Post",
      "description": "Standard blog article",
      "icon": "📝",
      "isSystem": false,
      "fieldsCount": 8,
      "entriesCount": 42,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-04-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 5,
    "limit": 50,
    "cursor": null,
    "hasNextPage": false
  }
}
```

---

### POST /api/v1/content-types 🛡

Create a new content type.

**Request body:**

```ts
{
  name: string           // slug: "blog-post"
  displayName: string    // "Blog Post"
  description?: string
  icon?: string
}
```

**Response `201`:**

```json
{
  "data": {
    "id": "clxyz123",
    "name": "blog-post",
    "displayName": "Blog Post",
    "description": null,
    "icon": "📝",
    "isSystem": false,
    "fields": [],
    "createdAt": "2026-04-22T10:00:00.000Z",
    "updatedAt": "2026-04-22T10:00:00.000Z"
  }
}
```

**Errors:** `400` `409`

---

### GET /api/v1/content-types/:name 👁

Get a content type with all its field definitions.

**Response `200`:**

```json
{
  "data": {
    "id": "clxyz123",
    "name": "blog-post",
    "displayName": "Blog Post",
    "isSystem": false,
    "fields": [
      {
        "id": "clfld001",
        "name": "title",
        "displayName": "Title",
        "type": "TEXT",
        "isRequired": true,
        "isLocalized": true,
        "isUnique": false,
        "position": 0,
        "config": { "maxLength": 255 },
        "defaultValue": null
      },
      {
        "id": "clfld002",
        "name": "body",
        "displayName": "Body",
        "type": "RICH_TEXT",
        "isRequired": false,
        "isLocalized": true,
        "isUnique": false,
        "position": 1,
        "config": {},
        "defaultValue": null
      }
    ]
  }
}
```

**Errors:** `404`

---

### PATCH /api/v1/content-types/:name 🛡

Update a content type's display properties.

**Request body:**

```ts
{
  displayName?: string
  description?: string
  icon?: string
}
```

**Response `200`:** Updated content type object.

**Errors:** `400` `403` `404`

> System types (`isSystem: true`) cannot be modified.

---

### DELETE /api/v1/content-types/:name 👑

Delete a content type. Fails if the type has any entries.

**Response `204`:** No content.

**Errors:** `403` `404` `422`

---

### POST /api/v1/content-types/:name/fields 🛡

Add a field to a content type.

**Request body:**

```ts
{
  name: string
  displayName: string
  type: ContentFieldType
  isRequired?: boolean        // default false
  isLocalized?: boolean       // default false
  isUnique?: boolean          // default false
  position?: number           // default appended to end
  config?: Record<string, unknown>
  defaultValue?: unknown
}
```

**Response `201`:** New field object.

**Errors:** `400` `404` `409`

---

### PATCH /api/v1/content-types/:name/fields/:fieldName 🛡

Update a field definition.

**Request body:**

```ts
{
  displayName?: string
  isRequired?: boolean
  position?: number
  config?: Record<string, unknown>
  defaultValue?: unknown
}
```

> `name` and `type` cannot be changed after creation.

**Response `200`:** Updated field object.

**Errors:** `400` `404`

---

### DELETE /api/v1/content-types/:name/fields/:fieldName 🛡

Remove a field from a content type.

**Response `204`:** No content.

**Errors:** `403` `404`

> Required system fields cannot be deleted.

---

## 4. Content Entries API

### GET /api/v1/content/:type ✏️

List entries of a content type. Includes drafts and trashed items for admin.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `status` | `draft` \| `published` \| `archived` \| `trashed` | Filter by status |
| `locale` | string | Filter by locale code |
| `limit` | number | Default `20` |
| `cursor` | string | Pagination cursor |
| `order` | `asc` \| `desc` | Default `desc` |
| `search` | string | Full-text search |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clentry001",
      "contentType": "blog-post",
      "status": "PUBLISHED",
      "isAiGenerated": false,
      "publishedAt": "2026-04-20T08:00:00.000Z",
      "scheduledAt": null,
      "locales": {
        "en": { "slug": "hello-world", "title": "Hello World" },
        "ar": { "slug": "مرحبا-بالعالم", "title": "مرحبا بالعالم" }
      },
      "createdBy": { "id": "cluser001", "firstName": "Oday" },
      "createdAt": "2026-04-18T00:00:00.000Z",
      "updatedAt": "2026-04-20T08:00:00.000Z"
    }
  ],
  "meta": {
    "total": 42,
    "limit": 20,
    "cursor": "clentry010",
    "hasNextPage": true
  }
}
```

---

### POST /api/v1/content/:type ✏️

Create a new content entry as a draft.

**Request body:**

```ts
{
  locale: string; // "en" — required, primary locale
  slug: string; // "hello-world"
  data: Record<string, unknown>; // { title: "Hello", body: "..." }
}
```

**Response `201`:**

```json
{
  "data": {
    "id": "clentry002",
    "contentType": "blog-post",
    "status": "DRAFT",
    "isAiGenerated": false,
    "publishedAt": null,
    "scheduledAt": null,
    "locales": {
      "en": {
        "slug": "hello-world",
        "data": { "title": "Hello World", "body": "" }
      }
    },
    "createdBy": { "id": "cluser001", "firstName": "Oday" },
    "createdAt": "2026-04-22T10:00:00.000Z",
    "updatedAt": "2026-04-22T10:00:00.000Z"
  }
}
```

**Errors:** `400` `404` `409`

---

### GET /api/v1/content/:type/:id ✏️

Get a single content entry with all locales and full field data.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `locale` | string | Return data for specific locale only |

**Response `200`:**

```json
{
  "data": {
    "id": "clentry001",
    "contentType": "blog-post",
    "status": "PUBLISHED",
    "isAiGenerated": false,
    "publishedAt": "2026-04-20T08:00:00.000Z",
    "scheduledAt": null,
    "locales": {
      "en": {
        "slug": "hello-world",
        "data": {
          "title": "Hello World",
          "body": "<p>Content here</p>",
          "heroImage": { "id": "clmedia001", "url": "https://..." }
        }
      },
      "ar": {
        "slug": "مرحبا-بالعالم",
        "data": {
          "title": "مرحبا بالعالم",
          "body": "<p>المحتوى هنا</p>",
          "heroImage": { "id": "clmedia001", "url": "https://..." }
        }
      }
    },
    "seoMeta": {
      "metaTitle": "Hello World | Kast Blog",
      "metaDescription": "A hello world post",
      "noIndex": false
    },
    "createdBy": { "id": "cluser001", "firstName": "Oday" },
    "versionsCount": 3,
    "createdAt": "2026-04-18T00:00:00.000Z",
    "updatedAt": "2026-04-20T08:00:00.000Z"
  }
}
```

**Errors:** `404`

---

### PATCH /api/v1/content/:type/:id ✏️

Update an entry's data for a specific locale.

**Request body:**

```ts
{
  locale: string
  slug?: string
  data?: Record<string, unknown>
}
```

**Response `200`:** Updated entry object.

**Errors:** `400` `404` `409`

---

### POST /api/v1/content/:type/:id/publish ✏️

Publish an entry. Triggers BullMQ SEO validation before publishing.

**Request body:**

```ts
{
  force?: boolean   // skip SEO validation warnings (not errors)
}
```

**Response `200`:**

```json
{
  "data": {
    "id": "clentry001",
    "status": "PUBLISHED",
    "publishedAt": "2026-04-22T10:00:00.000Z"
  }
}
```

**Errors:** `404` `422`

---

### POST /api/v1/content/:type/:id/unpublish ✏️

Revert a published entry back to draft.

**Response `200`:**

```json
{
  "data": {
    "id": "clentry001",
    "status": "DRAFT",
    "publishedAt": null
  }
}
```

**Errors:** `404` `422`

---

### POST /api/v1/content/:type/:id/schedule ✏️

Schedule an entry to publish at a future date.

**Request body:**

```ts
{
  scheduledAt: string; // ISO 8601: "2026-05-01T09:00:00.000Z"
}
```

**Response `200`:**

```json
{
  "data": {
    "id": "clentry001",
    "status": "SCHEDULED",
    "scheduledAt": "2026-05-01T09:00:00.000Z"
  }
}
```

**Errors:** `400` `404`

---

### DELETE /api/v1/content/:type/:id ✏️

Move an entry to trash. Recoverable within 30 days.

**Response `200`:**

```json
{
  "data": {
    "id": "clentry001",
    "status": "TRASHED",
    "trashedAt": "2026-04-22T10:00:00.000Z"
  }
}
```

**Errors:** `404`

---

### GET /api/v1/content/:type/:id/versions 👁

List all saved versions of an entry.

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clver001",
      "versionNumber": 3,
      "status": "PUBLISHED",
      "isAiGenerated": false,
      "savedBy": { "id": "cluser001", "firstName": "Oday" },
      "createdAt": "2026-04-20T08:00:00.000Z"
    },
    {
      "id": "clver002",
      "versionNumber": 2,
      "status": "DRAFT",
      "isAiGenerated": true,
      "savedBy": { "id": "cluser001", "firstName": "Oday" },
      "createdAt": "2026-04-19T10:00:00.000Z"
    }
  ],
  "meta": { "total": 3, "limit": 20, "cursor": null, "hasNextPage": false }
}
```

---

### GET /api/v1/content/:type/:id/versions/:versionNumber 👁

Get the full snapshot of a specific version.

**Response `200`:**

```json
{
  "data": {
    "id": "clver002",
    "versionNumber": 2,
    "status": "DRAFT",
    "data": { "heroImage": null },
    "localesData": {
      "en": { "slug": "hello-world", "data": { "title": "Hello World (old)", "body": "" } }
    },
    "isAiGenerated": false,
    "savedBy": { "id": "cluser001", "firstName": "Oday" },
    "createdAt": "2026-04-19T10:00:00.000Z"
  }
}
```

---

### POST /api/v1/content/:type/:id/versions/:versionNumber/restore ✏️

Restore an entry to a previous version. Creates a new version before restoring.

**Response `200`:** Current entry with restored data.

**Errors:** `404`

---

### POST /api/v1/content/:type/:id/locale ✏️

Add a new locale to an existing entry.

**Request body:**

```ts
{
  locale: string                        // "ar"
  slug: string                          // "مرحبا-بالعالم"
  data: Record<string, unknown>
  copyFromLocale?: string               // "en" — pre-fill data from another locale
}
```

**Response `201`:** Updated entry with new locale.

**Errors:** `400` `404` `409`

---

## 5. Content Delivery API (Public)

> These endpoints return **published** content only. Drafts and trashed entries are never returned.
> All delivery endpoints pass through all 3 security layers. The table below shows exact behavior per endpoint.

### Security Behavior Per Delivery Endpoint

| Endpoint                            | Layer 1 — CORS                | Layer 2 — Rate Limit             | Layer 3 — Auth               |
| ----------------------------------- | ----------------------------- | -------------------------------- | ---------------------------- |
| `GET /delivery/content/:type`       | `allowedOrigins` checked      | 100/min IP · 1000/min with key   | None · optional `X-Kast-Key` |
| `GET /delivery/content/:type/:slug` | `allowedOrigins` checked      | 100/min IP · 1000/min with key   | None · optional `X-Kast-Key` |
| `GET /delivery/sitemap.xml`         | **Always open** — CORS exempt | 200/min                          | Never required               |
| `GET /delivery/menus/:slug`         | `allowedOrigins` checked      | 100/min IP · 1000/min with key   | None · optional `X-Kast-Key` |
| `GET /delivery/settings`            | `allowedOrigins` checked      | 100/min IP · 1000/min with key   | None · optional `X-Kast-Key` |
| `POST /forms/:slug/submit`          | `allowedOrigins` checked      | **10/min IP — strict anti-spam** | Never required               |
| `GET /health`                       | **Always open** — CORS exempt | 200/min                          | Never required               |

### GET /api/v1/delivery/content/:type 🌐

> **CORS:** `allowedOrigins` | **Rate limit:** 100/min (IP) · 1000/min (`X-Kast-Key`) | **Auth:** None · optional `X-Kast-Key`

List published entries of a content type.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `locale` | string | Required. Return data in this locale |
| `limit` | number | Default `20` |
| `cursor` | string | Pagination cursor |
| `order` | `asc` \| `desc` | Default `desc` |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clentry001",
      "slug": "hello-world",
      "publishedAt": "2026-04-20T08:00:00.000Z",
      "data": {
        "title": "Hello World",
        "body": "<p>Content here</p>",
        "heroImage": { "id": "clmedia001", "url": "https://cdn.example.com/image.jpg" }
      },
      "seoMeta": {
        "metaTitle": "Hello World | Blog",
        "metaDescription": "A hello world post",
        "ogTitle": null,
        "ogImageUrl": null,
        "noIndex": false
      }
    }
  ],
  "meta": { "total": 42, "limit": 20, "cursor": "clentry010", "hasNextPage": true }
}
```

---

### GET /api/v1/delivery/content/:type/:slug 🌐

> **CORS:** `allowedOrigins` | **Rate limit:** 100/min (IP) · 1000/min (`X-Kast-Key`) | **Auth:** None · optional `X-Kast-Key`

Get a single published entry by its locale slug.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `locale` | string | Required |

**Response `200`:** Single entry in same shape as list item above.

**Errors:** `404`

---

### GET /api/v1/delivery/sitemap.xml 🌐❌

> **CORS:** **Always open — CORS exempt** (search engines send no Origin header) | **Rate limit:** 200/min | **Auth:** Never

Auto-generated XML sitemap of all published entries across all locales.

**Response `200`:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://example.com/blog/hello-world</loc>
    <lastmod>2026-04-20</lastmod>
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/blog/hello-world"/>
    <xhtml:link rel="alternate" hreflang="ar" href="https://example.com/ar/blog/مرحبا-بالعالم"/>
  </url>
</urlset>
```

---

## 6. SEO API

### GET /api/v1/seo/meta/:entryId 👁

Get SEO metadata for a content entry.

**Response `200`:**

```json
{
  "data": {
    "id": "clseo001",
    "entryId": "clentry001",
    "metaTitle": "Hello World | Kast Blog",
    "metaDescription": "A hello world post.",
    "ogTitle": null,
    "ogDescription": null,
    "ogImageUrl": null,
    "twitterTitle": null,
    "twitterDesc": null,
    "twitterImageUrl": null,
    "canonicalUrl": null,
    "noIndex": false,
    "noFollow": false,
    "structuredData": null,
    "latestScore": {
      "score": 78,
      "validatedAt": "2026-04-22T09:00:00.000Z",
      "issuesCount": { "error": 1, "warning": 2, "info": 0 }
    },
    "updatedAt": "2026-04-22T09:00:00.000Z"
  }
}
```

**Errors:** `404`

---

### PATCH /api/v1/seo/meta/:entryId ✏️

Update SEO metadata for an entry.

**Request body:**

```ts
{
  metaTitle?: string
  metaDescription?: string
  ogTitle?: string
  ogDescription?: string
  ogImageId?: string        // MediaFile ID
  twitterTitle?: string
  twitterDesc?: string
  twitterImageId?: string   // MediaFile ID
  canonicalUrl?: string
  noIndex?: boolean
  noFollow?: boolean
  structuredData?: Record<string, unknown>
}
```

**Response `200`:** Updated SEO meta object.

**Errors:** `400` `404`

---

### POST /api/v1/seo/validate/:entryId ✏️

Trigger a live SEO validation via the SEO MCP server. Queued via BullMQ.

**Response `202`:**

```json
{
  "data": {
    "jobId": "bullmq-job-abc123",
    "message": "SEO validation queued. Results available shortly."
  }
}
```

---

### GET /api/v1/seo/scores/:entryId 👁

Get historical SEO score records for an entry.

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clscore001",
      "score": 78,
      "validatedAt": "2026-04-22T09:00:00.000Z",
      "issues": [
        {
          "type": "meta-description-too-short",
          "severity": "WARNING",
          "message": "Meta description should be at least 120 characters.",
          "penalty": 10
        }
      ]
    }
  ],
  "meta": { "total": 5, "limit": 20, "cursor": null, "hasNextPage": false }
}
```

---

### GET /api/v1/seo/redirects 👁

List all redirect rules.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `isActive` | boolean | Filter by active status |
| `limit` | number | Default `20` |
| `cursor` | string | Cursor |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clredir001",
      "fromPath": "/old-blog/hello",
      "toPath": "/blog/hello-world",
      "type": "PERMANENT",
      "isActive": true,
      "hitCount": 142,
      "createdAt": "2026-01-15T00:00:00.000Z"
    }
  ],
  "meta": { "total": 12, "limit": 20, "cursor": null, "hasNextPage": false }
}
```

---

### POST /api/v1/seo/redirects 🛡

Create a redirect rule.

**Request body:**

```ts
{
  fromPath: string           // "/old-path"
  toPath: string             // "/new-path"
  type?: "PERMANENT" | "TEMPORARY"   // default "PERMANENT"
  isActive?: boolean         // default true
}
```

**Response `201`:** New redirect object.

**Errors:** `400` `409`

---

### PATCH /api/v1/seo/redirects/:id 🛡

Update a redirect rule.

**Request body:**

```ts
{
  toPath?: string
  type?: "PERMANENT" | "TEMPORARY"
  isActive?: boolean
}
```

**Response `200`:** Updated redirect object.

**Errors:** `400` `404`

---

### DELETE /api/v1/seo/redirects/:id 🛡

Delete a redirect rule permanently.

**Response `204`:** No content.

**Errors:** `404`

---

### POST /api/v1/seo/redirects/import 🛡

Bulk import redirects from a CSV file.

**Request:** `multipart/form-data` with `file` field (CSV: `fromPath,toPath,type`).

**Response `200`:**

```json
{
  "data": {
    "imported": 45,
    "skipped": 3,
    "errors": [{ "row": 12, "reason": "Duplicate fromPath" }]
  }
}
```

---

## 7. Media API

### GET /api/v1/media 👁

List media files.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `folderId` | string | Filter by folder |
| `mimeType` | string | e.g. `image/`, `video/` |
| `limit` | number | Default `20` |
| `cursor` | string | Cursor |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clmedia001",
      "filename": "hero-image-optimized.webp",
      "originalName": "hero-image.jpg",
      "mimeType": "image/webp",
      "size": 45230,
      "url": "https://cdn.example.com/media/hero-image-optimized.webp",
      "provider": "s3",
      "width": 1920,
      "height": 1080,
      "altText": "A beautiful hero image",
      "isAiAltText": false,
      "isAiGenerated": false,
      "folder": { "id": "clfolder001", "name": "Blog Images" },
      "usagesCount": 3,
      "createdAt": "2026-04-10T00:00:00.000Z"
    }
  ],
  "meta": { "total": 88, "limit": 20, "cursor": "clmedia010", "hasNextPage": true }
}
```

---

### POST /api/v1/media/upload ✏️

Upload a file. Triggers BullMQ media processing (resize, WebP conversion).

**Request:** `multipart/form-data`

| Field      | Type   | Description                 |
| ---------- | ------ | --------------------------- |
| `file`     | File   | The file to upload          |
| `folderId` | string | Target folder ID (optional) |
| `altText`  | string | Alt text (optional)         |

**Response `201`:**

```json
{
  "data": {
    "id": "clmedia002",
    "filename": "uploaded-image.webp",
    "originalName": "my-photo.jpg",
    "mimeType": "image/webp",
    "size": 38100,
    "url": "https://cdn.example.com/media/uploaded-image.webp",
    "provider": "s3",
    "width": 800,
    "height": 600,
    "altText": null,
    "isProcessing": true,
    "createdAt": "2026-04-22T10:00:00.000Z"
  }
}
```

**Errors:** `400` `413` (file too large) `415` (unsupported type)

---

### POST /api/v1/media/upload-url ✏️

Upload a file from a remote URL. Kast downloads and stores it.

**Request body:**

```ts
{
  url: string
  folderId?: string
  altText?: string
}
```

**Response `201`:** Same shape as file upload.

**Errors:** `400` `422`

---

### GET /api/v1/media/:id 👁

Get a single media file with full metadata and usage list.

**Response `200`:**

```json
{
  "data": {
    "id": "clmedia001",
    "filename": "hero-image-optimized.webp",
    "url": "https://cdn.example.com/media/hero-image-optimized.webp",
    "mimeType": "image/webp",
    "size": 45230,
    "width": 1920,
    "height": 1080,
    "altText": "A beautiful hero image",
    "isAiAltText": false,
    "provider": "s3",
    "folder": { "id": "clfolder001", "name": "Blog Images" },
    "usages": [
      {
        "entryId": "clentry001",
        "contentType": "blog-post",
        "fieldName": "heroImage",
        "entryTitle": "Hello World"
      }
    ],
    "createdAt": "2026-04-10T00:00:00.000Z",
    "updatedAt": "2026-04-10T00:00:00.000Z"
  }
}
```

**Errors:** `404`

---

### PATCH /api/v1/media/:id ✏️

Update media file metadata.

**Request body:**

```ts
{
  altText?: string
  folderId?: string
}
```

**Response `200`:** Updated media object.

**Errors:** `400` `404`

---

### DELETE /api/v1/media/:id ✏️

Move a media file to trash. Files in use cannot be trashed.

**Response `200`:**

```json
{
  "data": {
    "id": "clmedia001",
    "trashedAt": "2026-04-22T10:00:00.000Z"
  }
}
```

**Errors:** `404` `422`

---

### GET /api/v1/media/folders 👁

List all media folders.

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clfolder001",
      "name": "Blog Images",
      "parentId": null,
      "filesCount": 23,
      "children": [{ "id": "clfolder002", "name": "2026", "filesCount": 10 }]
    }
  ],
  "meta": { "total": 4, "limit": 50, "cursor": null, "hasNextPage": false }
}
```

---

### POST /api/v1/media/folders ✏️

Create a media folder.

**Request body:**

```ts
{
  name: string
  parentId?: string
}
```

**Response `201`:** New folder object.

---

### PATCH /api/v1/media/folders/:id ✏️

Rename a folder or move it to a different parent.

**Request body:**

```ts
{
  name?: string
  parentId?: string
}
```

**Response `200`:** Updated folder.

---

### DELETE /api/v1/media/folders/:id 🛡

Delete an empty folder.

**Response `204`:** No content.

**Errors:** `404` `422` (folder is not empty)

---

## 8. Users API

### GET /api/v1/users 🛡

List all admin users.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `role` | string | Filter by role name |
| `isActive` | boolean | Filter by active status |
| `limit` | number | Default `20` |
| `cursor` | string | Cursor |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "cluser001",
      "email": "oday@kastcms.com",
      "firstName": "Oday",
      "lastName": "Bakkour",
      "avatarUrl": null,
      "isActive": true,
      "isVerified": true,
      "roles": ["SUPER_ADMIN"],
      "lastLoginAt": "2026-04-22T09:00:00.000Z",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "total": 5, "limit": 20, "cursor": null, "hasNextPage": false }
}
```

---

### POST /api/v1/users 🛡

Create a new admin user and send an invitation email.

**Request body:**

```ts
{
  email: string
  firstName?: string
  lastName?: string
  roleNames: string[]   // ["editor"]
  sendInvite?: boolean  // default true
}
```

**Response `201`:** New user object.

**Errors:** `400` `409`

---

### GET /api/v1/users/:id 🛡

Get a single user.

**Response `200`:** Single user object (same shape as list item).

**Errors:** `404`

---

### PATCH /api/v1/users/:id 🛡

Update a user.

**Request body:**

```ts
{
  firstName?: string
  lastName?: string
  isActive?: boolean
  roleNames?: string[]
}
```

**Response `200`:** Updated user object.

**Errors:** `400` `404`

---

### DELETE /api/v1/users/:id 🛡

Move a user to trash.

**Response `200`:**

```json
{
  "data": {
    "id": "cluser002",
    "trashedAt": "2026-04-22T10:00:00.000Z"
  }
}
```

**Errors:** `403` `404`

> SUPER_ADMIN cannot be trashed.

---

## 9. Roles & Permissions API

### GET /api/v1/roles 🛡

List all roles.

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clrole001",
      "name": "super_admin",
      "displayName": "Super Admin",
      "isSystem": true,
      "usersCount": 1,
      "permissionsCount": 0
    },
    {
      "id": "clrole002",
      "name": "editor",
      "displayName": "Editor",
      "isSystem": true,
      "usersCount": 3,
      "permissionsCount": 12
    }
  ],
  "meta": { "total": 4, "limit": 20, "cursor": null, "hasNextPage": false }
}
```

---

### POST /api/v1/roles 👑

Create a custom role.

**Request body:**

```ts
{
  name: string           // "content-manager"
  displayName: string    // "Content Manager"
  description?: string
}
```

**Response `201`:** New role object.

**Errors:** `400` `409`

---

### GET /api/v1/roles/:id 🛡

Get a role with its full permission list.

**Response `200`:**

```json
{
  "data": {
    "id": "clrole002",
    "name": "editor",
    "displayName": "Editor",
    "isSystem": true,
    "permissions": [
      { "id": "clperm001", "resource": "content", "action": "read", "scope": "*" },
      { "id": "clperm002", "resource": "content", "action": "create", "scope": "*" },
      { "id": "clperm003", "resource": "content", "action": "update", "scope": "*" }
    ]
  }
}
```

---

### PATCH /api/v1/roles/:id 👑

Update a custom role's display properties.

**Request body:**

```ts
{
  displayName?: string
  description?: string
}
```

**Response `200`:** Updated role object.

**Errors:** `403` (system roles) `404`

---

### DELETE /api/v1/roles/:id 👑

Delete a custom role.

**Response `204`:** No content.

**Errors:** `403` (system roles) `404` `422` (role has assigned users)

---

### POST /api/v1/roles/:id/permissions 👑

Assign permissions to a role.

**Request body:**

```ts
{
  permissions: Array<{
    resource: string; // "content", "media", "seo"
    action: string; // "read", "create", "update", "delete", "publish"
    scope?: string; // "*" or specific content type name
  }>;
}
```

**Response `200`:** Updated role with new permissions.

---

### DELETE /api/v1/roles/:id/permissions/:permissionId 👑

Remove a permission from a role.

**Response `204`:** No content.

---

## 10. API Tokens API

### GET /api/v1/tokens 🔑

List API tokens for the authenticated user.

**Response `200`:**

```json
{
  "data": [
    {
      "id": "cltoken001",
      "name": "Frontend SDK",
      "prefix": "kast_abc1",
      "scope": "READ_ONLY",
      "lastUsedAt": "2026-04-21T15:00:00.000Z",
      "expiresAt": null,
      "revokedAt": null,
      "createdAt": "2026-01-10T00:00:00.000Z"
    }
  ],
  "meta": { "total": 2, "limit": 20, "cursor": null, "hasNextPage": false }
}
```

---

### POST /api/v1/tokens 🔑

Create a new API token. **The plain token is returned once and never again.**

**Request body:**

```ts
{
  name: string
  scope: "READ_ONLY" | "FULL_ACCESS" | "SCOPED"
  scopeData?: Record<string, string[]>   // only if scope = "SCOPED"
  expiresAt?: string                     // ISO 8601
}
```

**Response `201`:**

```json
{
  "data": {
    "id": "cltoken002",
    "name": "CI Deploy Token",
    "prefix": "kast_xyz9",
    "scope": "SCOPED",
    "scopeData": { "content": ["read", "create"] },
    "token": "kast_xyz9abcdefghijklmnopqrstuvwxyz0123456789",
    "createdAt": "2026-04-22T10:00:00.000Z"
  }
}
```

> `token` is only present in this response. Store it securely.

---

### DELETE /api/v1/tokens/:id 🔑

Revoke an API token immediately.

**Response `204`:** No content.

**Errors:** `403` `404`

---

## 11. Agent Tokens API

### GET /api/v1/agent-tokens 🛡

List all MCP agent tokens.

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clat001",
      "name": "Claude Agent",
      "prefix": "kastagent_abc1",
      "scope": { "content": ["read", "write"], "plugins": ["read"] },
      "lastUsedAt": "2026-04-22T08:00:00.000Z",
      "revokedAt": null,
      "createdAt": "2026-03-01T00:00:00.000Z"
    }
  ],
  "meta": { "total": 2, "limit": 20, "cursor": null, "hasNextPage": false }
}
```

---

### POST /api/v1/agent-tokens 🛡

Create a new agent token for an AI client. **Plain token shown once.**

**Request body:**

```ts
{
  name: string;
  scope: Record<string, string[]>; // { content: ["read","write"] }
}
```

**Response `201`:**

```json
{
  "data": {
    "id": "clat002",
    "name": "Cursor Dev Agent",
    "prefix": "kastagent_xyz9",
    "scope": { "content": ["read", "write", "publish"] },
    "token": "kastagent_xyz9abcdefghijklmnopqrstuvwxyz",
    "createdAt": "2026-04-22T10:00:00.000Z"
  }
}
```

---

### DELETE /api/v1/agent-tokens/:id 🛡

Revoke an agent token.

**Response `204`:** No content.

---

### GET /api/v1/agent-tokens/:id/sessions 🛡

Get MCP session history for an agent token.

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clsess001",
      "agentName": "claude-sonnet-4",
      "toolsUsed": ["kast_content_list", "kast_content_publish"],
      "startedAt": "2026-04-22T08:00:00.000Z",
      "endedAt": "2026-04-22T08:01:32.000Z"
    }
  ],
  "meta": { "total": 8, "limit": 20, "cursor": null, "hasNextPage": false }
}
```

---

## 12. Locales API

### GET /api/v1/locales 👁

List all configured locales.

**Response `200`:**

```json
{
  "data": [
    {
      "code": "en",
      "name": "English",
      "nativeName": "English",
      "direction": "LTR",
      "isDefault": true,
      "isActive": true,
      "fallbackCode": null
    },
    {
      "code": "ar",
      "name": "Arabic",
      "nativeName": "العربية",
      "direction": "RTL",
      "isDefault": false,
      "isActive": true,
      "fallbackCode": "en"
    }
  ],
  "meta": { "total": 2, "limit": 50, "cursor": null, "hasNextPage": false }
}
```

---

### POST /api/v1/locales 🛡

Add a new locale.

**Request body:**

```ts
{
  code: string          // "fr"
  name: string          // "French"
  nativeName: string    // "Français"
  direction?: "LTR" | "RTL"   // default "LTR"
  isDefault?: boolean   // default false
  fallbackCode?: string // "en"
}
```

**Response `201`:** New locale object.

**Errors:** `400` `409`

---

### PATCH /api/v1/locales/:code 🛡

Update a locale's properties.

**Request body:**

```ts
{
  name?: string
  nativeName?: string
  isDefault?: boolean
  isActive?: boolean
  fallbackCode?: string
}
```

**Response `200`:** Updated locale object.

**Errors:** `404`

---

### DELETE /api/v1/locales/:code 👑

Remove a locale. Fails if the locale has content entries.

**Response `204`:** No content.

**Errors:** `404` `422`

---

## 13. Webhooks API

### GET /api/v1/webhooks 🛡

List webhook endpoints.

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clwh001",
      "name": "Production n8n",
      "url": "https://n8n.example.com/webhook/abc123",
      "isActive": true,
      "events": ["content.published", "form.submitted"],
      "deliveriesCount": 142,
      "lastDeliveryAt": "2026-04-22T09:55:00.000Z",
      "createdAt": "2026-02-01T00:00:00.000Z"
    }
  ],
  "meta": { "total": 2, "limit": 20, "cursor": null, "hasNextPage": false }
}
```

---

### POST /api/v1/webhooks 🛡

Create a webhook endpoint.

**Request body:**

```ts
{
  name: string
  url: string
  secret: string          // HMAC signing secret — stored hashed
  events: string[]        // ["content.published", "media.uploaded"]
  isActive?: boolean      // default true
}
```

**Response `201`:** New webhook object (secret is not returned).

**Errors:** `400` `409`

---

### PATCH /api/v1/webhooks/:id 🛡

Update a webhook.

**Request body:**

```ts
{
  name?: string
  url?: string
  secret?: string
  events?: string[]
  isActive?: boolean
}
```

**Response `200`:** Updated webhook.

---

### DELETE /api/v1/webhooks/:id 🛡

Delete a webhook endpoint and all its delivery logs.

**Response `204`:** No content.

---

### POST /api/v1/webhooks/:id/test 🛡

Send a test ping to the webhook endpoint.

**Response `200`:**

```json
{
  "data": {
    "statusCode": 200,
    "responseBody": "OK",
    "durationMs": 234
  }
}
```

---

### GET /api/v1/webhooks/:id/deliveries 🛡

Get delivery logs for a webhook.

**Query params:** `status` (`succeeded` | `failed` | `pending`), `limit`, `cursor`

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clwhdlv001",
      "event": "content.published",
      "statusCode": 200,
      "attempts": 1,
      "succeededAt": "2026-04-22T09:55:01.000Z",
      "failedAt": null,
      "createdAt": "2026-04-22T09:55:00.000Z"
    }
  ],
  "meta": { "total": 142, "limit": 20, "cursor": "clwhdlv010", "hasNextPage": true }
}
```

---

## 14. Plugins API

### GET /api/v1/plugins 🛡

List all installed plugins.

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clplug001",
      "name": "@kast-cms/plugin-stripe",
      "displayName": "Stripe Payments",
      "version": "1.2.0",
      "isActive": true,
      "isSystemPlugin": false,
      "hasConfig": true,
      "installedAt": "2026-03-01T00:00:00.000Z"
    }
  ],
  "meta": { "total": 3, "limit": 20, "cursor": null, "hasNextPage": false }
}
```

---

### POST /api/v1/plugins/install 👑

Install a plugin by name and version.

**Request body:**

```ts
{
  name: string; // "@kast-cms/plugin-meilisearch"
  version: string; // "1.0.0"
}
```

**Response `201`:** New plugin object.

**Errors:** `400` `409`

---

### PATCH /api/v1/plugins/:name/enable 👑

Enable an installed plugin.

**Response `200`:**

```json
{
  "data": { "name": "@kast-cms/plugin-stripe", "isActive": true }
}
```

---

### PATCH /api/v1/plugins/:name/disable 👑

Disable a plugin without uninstalling it.

**Response `200`:**

```json
{
  "data": { "name": "@kast-cms/plugin-stripe", "isActive": false }
}
```

---

### DELETE /api/v1/plugins/:name 👑

Uninstall a plugin.

**Response `204`:** No content.

**Errors:** `403` (system plugins) `404`

---

### GET /api/v1/plugins/:name/config 🛡

Get plugin configuration (sensitive values are redacted).

**Response `200`:**

```json
{
  "data": {
    "pluginName": "@kast-cms/plugin-stripe",
    "config": {
      "publicKey": "pk_live_...",
      "secretKey": "sk_live_***REDACTED***",
      "webhookSecret": "whsec_***REDACTED***",
      "currency": "USD"
    }
  }
}
```

---

### PATCH /api/v1/plugins/:name/config 👑

Update plugin configuration.

**Request body:**

```ts
{
  config: Record<string, unknown>;
}
```

**Response `200`:** Updated config (sensitive values redacted).

---

## 15. Forms API

### GET /api/v1/forms 🛡

List all forms.

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clform001",
      "name": "Contact Form",
      "slug": "contact",
      "isActive": true,
      "fieldsCount": 4,
      "submissionsCount": 87,
      "unreadCount": 12,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "total": 3, "limit": 20, "cursor": null, "hasNextPage": false }
}
```

---

### POST /api/v1/forms 🛡

Create a form.

**Request body:**

```ts
{
  name: string
  slug: string
  description?: string
  notifyEmail?: string
  fields: Array<{
    name: string
    label: string
    type: FormFieldType
    isRequired?: boolean
    position?: number
    config?: Record<string, unknown>
  }>
}
```

**Response `201`:** New form with fields.

**Errors:** `400` `409`

---

### GET /api/v1/forms/:id 🛡

Get a form with all its fields.

**Response `200`:**

```json
{
  "data": {
    "id": "clform001",
    "name": "Contact Form",
    "slug": "contact",
    "isActive": true,
    "notifyEmail": "admin@kastcms.com",
    "fields": [
      {
        "id": "clff001",
        "name": "name",
        "label": "Your Name",
        "type": "TEXT",
        "isRequired": true,
        "position": 0,
        "config": {}
      },
      {
        "id": "clff002",
        "name": "email",
        "label": "Email Address",
        "type": "EMAIL",
        "isRequired": true,
        "position": 1,
        "config": {}
      },
      {
        "id": "clff003",
        "name": "message",
        "label": "Message",
        "type": "TEXTAREA",
        "isRequired": true,
        "position": 2,
        "config": { "rows": 5 }
      }
    ],
    "submissionsCount": 87,
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

---

### PATCH /api/v1/forms/:id 🛡

Update a form.

**Request body:**

```ts
{
  name?: string
  description?: string
  notifyEmail?: string
  isActive?: boolean
}
```

**Response `200`:** Updated form.

---

### DELETE /api/v1/forms/:id 🛡

Move a form to trash.

**Response `200`:** Trashed form.

---

### GET /api/v1/forms/:id/submissions 🛡

List submissions for a form.

**Query params:** `isRead` (boolean), `limit`, `cursor`

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clsub001",
      "formId": "clform001",
      "data": { "name": "Ahmed Ali", "email": "ahmed@example.com", "message": "Hello!" },
      "ipAddress": "1.2.3.4",
      "isRead": false,
      "readAt": null,
      "createdAt": "2026-04-22T09:30:00.000Z"
    }
  ],
  "meta": { "total": 87, "limit": 20, "cursor": "clsub010", "hasNextPage": true }
}
```

---

### PATCH /api/v1/forms/:id/submissions/:submissionId/read 🛡

Mark a submission as read.

**Response `200`:**

```json
{
  "data": { "id": "clsub001", "isRead": true, "readAt": "2026-04-22T10:00:00.000Z" }
}
```

---

### POST /api/v1/forms/:slug/submit 🌐

Submit a form. **Public endpoint — no auth required.** CORS-checked. **Strict rate limit: 10 submissions per IP per minute** (`rateLimit.forms.max`).

**Request body:**

```ts
{
  [fieldName: string]: unknown   // dynamic based on form fields
}
```

**Example:**

```json
{
  "name": "Ahmed Ali",
  "email": "ahmed@example.com",
  "message": "Hello from your contact form!"
}
```

**Response `201`:**

```json
{
  "data": {
    "message": "Your submission has been received. Thank you!"
  }
}
```

**Errors:** `400` (validation) `404` (form not found) `422` (form inactive) `429`

---

## 16. Menus API

### GET /api/v1/menus 👁

List all menus.

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clmenu001",
      "name": "Main Navigation",
      "slug": "main-nav",
      "localeCode": "en",
      "itemsCount": 6,
      "updatedAt": "2026-04-15T00:00:00.000Z"
    }
  ],
  "meta": { "total": 3, "limit": 20, "cursor": null, "hasNextPage": false }
}
```

---

### POST /api/v1/menus 🛡

Create a menu.

**Request body:**

```ts
{
  name: string
  slug: string
  localeCode?: string
}
```

**Response `201`:** New menu.

**Errors:** `400` `409`

---

### PATCH /api/v1/menus/:id 🛡

Update a menu.

**Request body:**

```ts
{
  name?: string
  localeCode?: string
}
```

**Response `200`:** Updated menu.

---

### DELETE /api/v1/menus/:id 🛡

Delete a menu and all its items.

**Response `204`:** No content.

---

### POST /api/v1/menus/:id/items 🛡

Add an item to a menu.

**Request body:**

```ts
{
  label: string
  url?: string          // external URL
  entryId?: string      // internal content entry
  parentId?: string     // parent item ID for nested menus
  target?: "_blank" | "_self"
  position?: number
}
```

**Response `201`:** New menu item.

---

### PATCH /api/v1/menus/:id/items/:itemId 🛡

Update a menu item.

**Request body:**

```ts
{
  label?: string
  url?: string
  entryId?: string
  parentId?: string
  target?: string
  position?: number
  isActive?: boolean
}
```

**Response `200`:** Updated item.

---

### DELETE /api/v1/menus/:id/items/:itemId 🛡

Remove a menu item and all its children.

**Response `204`:** No content.

---

### GET /api/v1/delivery/menus/:slug 🌐

Get a menu with full tree. **Public endpoint.** CORS-checked. Optional `X-Kast-Key` for server-side callers.

**Query params:** `locale` (optional)

**Response `200`:**

```json
{
  "data": {
    "id": "clmenu001",
    "name": "Main Navigation",
    "slug": "main-nav",
    "items": [
      {
        "id": "clmi001",
        "label": "Home",
        "url": "/",
        "entryId": null,
        "target": "_self",
        "position": 0,
        "isActive": true,
        "children": []
      },
      {
        "id": "clmi002",
        "label": "Blog",
        "url": "/blog",
        "target": "_self",
        "position": 1,
        "isActive": true,
        "children": [
          {
            "id": "clmi003",
            "label": "Latest Posts",
            "url": "/blog/latest",
            "position": 0,
            "children": []
          }
        ]
      }
    ]
  }
}
```

---

## 17. Settings API

### GET /api/v1/settings 🛡

List all global settings grouped by group.

**Query params:** `group` (filter by group: `site`, `seo`, `media`, `auth`, `email`)

**Response `200`:**

```json
{
  "data": [
    {
      "id": "clset001",
      "key": "site.name",
      "value": "My Kast Site",
      "group": "site",
      "label": "Site Name",
      "isPublic": true,
      "updatedAt": "2026-04-01T00:00:00.000Z"
    },
    {
      "id": "clset002",
      "key": "site.description",
      "value": "A website powered by Kast CMS",
      "group": "site",
      "label": "Site Description",
      "isPublic": true,
      "updatedAt": "2026-04-01T00:00:00.000Z"
    }
  ],
  "meta": { "total": 14, "limit": 50, "cursor": null, "hasNextPage": false }
}
```

---

### PATCH /api/v1/settings/:key 🛡

Update a single setting by its key.

**Request body:**

```ts
{
  value: unknown; // string, number, boolean, array — depends on setting
}
```

**Response `200`:**

```json
{
  "data": {
    "key": "site.name",
    "value": "My New Site Name",
    "updatedAt": "2026-04-22T10:00:00.000Z"
  }
}
```

**Errors:** `400` `404`

---

### GET /api/v1/delivery/settings 🌐

Get all public settings. **Public endpoint.** CORS-checked. Optional `X-Kast-Key` for server-side callers.

**Response `200`:**

```json
{
  "data": {
    "site.name": "My Kast Site",
    "site.description": "A website powered by Kast CMS",
    "site.logoUrl": "https://cdn.example.com/logo.svg"
  }
}
```

---

## 18. Audit API

### GET /api/v1/audit 🛡

List audit log entries.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `userId` | string | Filter by user |
| `agentTokenId` | string | Filter by AI agent |
| `resource` | string | e.g. `ContentEntry`, `User` |
| `resourceId` | string | Specific resource ID |
| `action` | string | e.g. `content.publish` |
| `isDryRun` | boolean | MCP dry-run entries only |
| `from` | ISO date | Start of date range |
| `to` | ISO date | End of date range |
| `limit` | number | Default `20` |
| `cursor` | string | Cursor |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "claudit001",
      "user": { "id": "cluser001", "email": "oday@kastcms.com" },
      "agentName": null,
      "agentTokenId": null,
      "ipAddress": "1.2.3.4",
      "action": "content.publish",
      "resource": "ContentEntry",
      "resourceId": "clentry001",
      "before": { "status": "DRAFT" },
      "after": { "status": "PUBLISHED" },
      "isDryRun": false,
      "createdAt": "2026-04-22T10:00:00.000Z"
    }
  ],
  "meta": { "total": 312, "limit": 20, "cursor": "claudit010", "hasNextPage": true }
}
```

---

### GET /api/v1/audit/export 🛡

Export audit logs as CSV or JSON.

**Query params:** Same filters as list + `format` (`csv` | `json`, default `json`)

**Response:** File download (`Content-Disposition: attachment`).

---

## 19. Trash API

### GET /api/v1/trash 🛡

List all trashed items across all resource types.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `resource` | string | `ContentEntry`, `MediaFile`, `User`, `Form` |
| `limit` | number | Default `20` |
| `cursor` | string | Cursor |

**Response `200`:**

```json
{
  "data": [
    {
      "resource": "ContentEntry",
      "id": "clentry099",
      "label": "Old Blog Post (blog-post)",
      "trashedAt": "2026-04-20T08:00:00.000Z",
      "trashedBy": { "id": "cluser001", "firstName": "Oday" },
      "permanentDeleteAt": "2026-05-20T08:00:00.000Z"
    }
  ],
  "meta": { "total": 8, "limit": 20, "cursor": null, "hasNextPage": false }
}
```

---

### POST /api/v1/trash/:resource/:id/restore 🛡

Restore a trashed item. Only ADMIN and SUPER_ADMIN can restore.

**Response `200`:**

```json
{
  "data": {
    "id": "clentry099",
    "resource": "ContentEntry",
    "status": "DRAFT",
    "restoredAt": "2026-04-22T10:00:00.000Z"
  }
}
```

**Errors:** `403` `404`

---

### DELETE /api/v1/trash/:resource/:id 👑

Permanently delete a trashed item immediately. SUPER_ADMIN only. Cannot be undone.

**Response `204`:** No content.

**Errors:** `403` `404`

---

## 20. Health API

### GET /api/v1/health 🌐❌

System health check. Used by load balancers and monitoring. **CORS-exempt** — monitoring tools must always reach this.

**Response `200`:**

```json
{
  "data": {
    "status": "ok",
    "version": "1.0.0",
    "timestamp": "2026-04-22T10:00:00.000Z",
    "services": {
      "database": "ok",
      "redis": "ok",
      "storage": "ok"
    }
  }
}
```

**Response `503`** (if any service is down):

```json
{
  "data": {
    "status": "degraded",
    "services": {
      "database": "ok",
      "redis": "error",
      "storage": "ok"
    }
  }
}
```

---

## Endpoint Summary

| Count   | Category                     |
| ------- | ---------------------------- |
| 10      | Auth                         |
| 8       | Content Types                |
| 11      | Content Entries              |
| 3       | Content Delivery (Public 🌐) |
| 7       | SEO                          |
| 9       | Media                        |
| 5       | Users                        |
| 6       | Roles & Permissions          |
| 3       | API Tokens                   |
| 4       | Agent Tokens                 |
| 4       | Locales                      |
| 6       | Webhooks                     |
| 7       | Plugins                      |
| 9       | Forms                        |
| 7       | Menus                        |
| 3       | Settings                     |
| 2       | Audit                        |
| 3       | Trash                        |
| 1       | Health                       |
| **107** | **Total**                    |

### Public endpoint breakdown

| Symbol    | Count | Description                                       |
| --------- | ----- | ------------------------------------------------- |
| 🌐        | 6     | CORS + rate limit enforced. Optional `X-Kast-Key` |
| 🌐❌      | 2     | Fully open — sitemap + health                     |
| Protected | 99    | JWT / API token / agent token required            |

---

_Document version: 0.1_
_Last updated: April 2026_
_Endpoints: 107 | Public: 8 | Auth required: 99_
_Status: Ready for NestJS implementation_

---
title: Authentication
description: Login, refresh tokens, OAuth, and password reset endpoints.
---

All API responses use the envelope format `{ "data": ... }`. Errors are wrapped in an `error` object — see [Errors & pagination](#errors--pagination) below.

## Base URL

```
http://localhost:3000/api/v1
```

Every route is served under the global `/api` prefix with URI versioning (`v1`), so the fully-qualified base is `http://localhost:3000/api/v1`.

## Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "your-password"
}
```

**Response:**

```json
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 900
  }
}
```

Rate limit: 20 requests / 15 minutes per IP.

## Refresh token

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{ "refreshToken": "eyJ..." }
```

Returns a new `accessToken` and rotated `refreshToken`. The old refresh token is invalidated immediately.

## Logout

```http
POST /api/v1/auth/logout
Authorization: Bearer <accessToken>

{ "refreshToken": "eyJ..." }
```

Revokes the refresh token. Returns `204 No Content`.

## Get current user

```http
GET /api/v1/auth/me
Authorization: Bearer <accessToken>
```

## Update profile

```http
PATCH /api/v1/auth/me
Authorization: Bearer <accessToken>

{ "name": "Oday Bakkour" }
```

## OAuth — Google

```http
GET /api/v1/auth/oauth/google
```

Redirects to Google's OAuth consent screen. On success, redirects to `/oauth-callback?accessToken=...&refreshToken=...`.

```http
GET /api/v1/auth/oauth/github
```

Same flow for GitHub.

## Password reset

### Request reset email

```http
POST /api/v1/auth/forgot-password
Content-Type: application/json

{ "email": "user@example.com" }
```

Always returns `200` regardless of whether the email exists (prevents enumeration). Rate limit: 5 / 15 minutes.

### Submit new password

```http
POST /api/v1/auth/reset-password
Content-Type: application/json

{
  "token": "<token-from-email-link>",
  "newPassword": "new-secure-password"
}
```

Token is single-use and expires after 1 hour. On success, all refresh tokens for the user are revoked.

## Authorization header

Include the access token in every authenticated request:

```
Authorization: Bearer eyJ...
```

Or use a read-only delivery API key for public content access:

```
X-Kast-Key: kast_readonly_...
```

A delivery key is only honoured on the public [Delivery API](/api-reference/delivery/) (`/api/v1/delivery/*`). On those endpoints it is optional — when present, the CORS origin check is bypassed and a higher rate-limit ceiling applies. Use it for trusted server-side callers (SSR, mobile backends).

## Errors & pagination

### Error envelope

Every error response is wrapped in an `error` object:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Content entry not found",
    "statusCode": 404,
    "timestamp": "2026-04-22T10:00:00.000Z",
    "path": "/api/v1/content-types/blog-post/entries/abc123"
  }
}
```

| HTTP | Code                  | When                                                    |
| ---- | --------------------- | ------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`    | Invalid request body or query params                    |
| 401  | `UNAUTHORIZED`        | Missing or invalid token                                |
| 403  | `FORBIDDEN`           | Token valid but insufficient role                       |
| 403  | `CORS_ORIGIN_BLOCKED` | Request origin not allowed (Layer 1 rejection)          |
| 404  | `NOT_FOUND`           | Resource does not exist                                 |
| 409  | `CONFLICT`            | Unique constraint violation (e.g. duplicate slug)       |
| 422  | `UNPROCESSABLE`       | Business-rule violation (e.g. publish with missing SEO) |
| 429  | `RATE_LIMITED`        | Too many requests — `Retry-After` header included       |
| 500  | `INTERNAL_ERROR`      | Unexpected server error                                 |
| 503  | `SERVICE_UNAVAILABLE` | Downstream service (storage, queue) unreachable         |

### Pagination

List endpoints return a `meta` block and accept cursor-based pagination:

```json
{
  "data": [],
  "meta": { "total": 100, "limit": 20, "cursor": "clxyz123...", "hasNextPage": true }
}
```

| Query param | Type            | Default | Description                                   |
| ----------- | --------------- | ------- | --------------------------------------------- |
| `limit`     | number          | `20`    | Items per page (max `100`)                    |
| `cursor`    | string          | —       | Opaque cursor from the previous `meta.cursor` |
| `order`     | `asc` \| `desc` | `desc`  | Sort direction by `createdAt`                 |

Pass the previous response's `meta.cursor` as the next request's `cursor` until `hasNextPage` is `false`.

### Rate limits

| Caller                       | Window | Max  |
| ---------------------------- | ------ | ---- |
| Public IP (no key)           | 1 min  | 100  |
| Valid `X-Kast-Key`           | 1 min  | 1000 |
| Authenticated admin          | 1 min  | 300  |
| Auth endpoints (login, etc.) | 15 min | 20   |
| Form submissions (per IP)    | 1 min  | 10   |

Responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers; `429` responses add `Retry-After`.

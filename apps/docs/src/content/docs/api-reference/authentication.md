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
Content-Type: application/json

{ "refreshToken": "eyJ..." }
```

Revokes the refresh token. Returns `204 No Content`.

**No `Authorization` header is required.** The refresh token in the body _is_ the
credential being surrendered, so the route grants nothing a caller does not
already hold, and requiring an access token would break the common case: a
browser logout is issued by a server-side route handler that can read only the
httpOnly refresh cookie. Rate limit: 60 / minute.

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

## OAuth

```http
GET /api/v1/auth/oauth/google
GET /api/v1/auth/oauth/github
```

Redirects to the provider's consent screen. On success the browser is sent to
`<ADMIN_URL>/oauth-callback?code=...` — a **single-use authorization code**, not
the tokens. Tokens in a redirect URL leak through browser history, the
`Referer` header and server logs.

Exchange the code within 60 seconds:

```http
POST /api/v1/auth/oauth/exchange
Content-Type: application/json

{ "code": "<code-from-callback>" }
```

Returns the token pair. The code is deleted on exchange, even if it had expired.

:::caution
`ADMIN_URL` must include the admin's base path (`http://localhost:3001/admin` by
default) — the callback is a page in the admin app, not an API route.
:::

### Self-registration policy

An OAuth identity with **no matching account cannot create one** unless the
installation opts in. Any provider will return an address for any inbox its own
users control, so auto-provisioning is a self-registration policy rather than an
authentication detail, and it fails closed.

| Variable                        | Values                                        | Default    |
| ------------------------------- | --------------------------------------------- | ---------- |
| `OAUTH_SIGNUP_MODE`             | `disabled` / `allowlist` / `open`             | `disabled` |
| `OAUTH_SIGNUP_ALLOWED_DOMAINS`  | comma-separated email domains, allowlist mode | empty      |
| `OAUTH_SIGNUP_REQUIRE_VERIFIED` | `true` / `false`                              | `true`     |

An unrecognised `OAUTH_SIGNUP_MODE` logs a warning and falls back to `disabled`.
Set `OAUTH_SIGNUP_REQUIRE_VERIFIED=false` only for providers that do not assert
the claim (GitHub). Signing in to an account that already exists is unaffected.

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

Token is single-use and expires after 1 hour. On success, all refresh tokens for
the user are revoked.

Redemption is atomic: the token is claimed by a conditional update inside one
transaction, so two concurrent submissions of the same token produce exactly one
winner and the loser gets `400`.

## Accept an invitation

```http
POST /api/v1/auth/accept-invite
Content-Type: application/json

{
  "token": "<token-from-invitation-email>",
  "password": "new-secure-password"
}
```

Sets the password on an invited account and marks it verified. The invitation
token is single-use and expires after 7 days; an administrator can re-send or
revoke it (`POST` / `DELETE /api/v1/users/:id/invite`). Rate limit: 5 / 15
minutes.

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

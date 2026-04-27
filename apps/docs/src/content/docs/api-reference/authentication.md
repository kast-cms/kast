---
title: Authentication
description: Login, refresh tokens, OAuth, and password reset endpoints.
---

All API responses use the envelope format `{ "data": ... }`. Errors use `{ "statusCode", "error", "message" }`.

## Base URL

```
http://localhost:3000/api/v1
```

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

Or use a delivery API key for read-only access:

```
X-Kast-Key: kast_live_...
```

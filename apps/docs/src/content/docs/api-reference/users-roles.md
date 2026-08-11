---
title: Users & Roles API
description: Manage users, roles, and API tokens programmatically.
---

Requires `ADMIN+` for most operations.

## List users

```http
GET /api/v1/users
Authorization: Bearer <token>
```

Query: `?limit=20&cursor=<cursor>&role=editor`

## Get user

```http
GET /api/v1/users/:id
Authorization: Bearer <token>
```

## Invite user

```http
POST /api/v1/users
Authorization: Bearer <token>   (ADMIN+)

{ "email": "editor@example.com", "roleNames": ["editor"] }
```

Creates the account with **no password** and emails a single-use invitation link
valid for 7 days. The invitee completes registration with
`POST /api/v1/auth/accept-invite`, which sets the password and marks the account
verified.

While the invitation is unredeemed the user's `hasPendingInvite` is `true`.

### Re-send an invitation

```http
POST /api/v1/users/:id/invite
Authorization: Bearer <token>   (ADMIN+)
```

Issues a fresh token — the previous one stops working — and mails it again.
Refused with `422` once the account has a password: that would be a silent
password reset, which is what the forgot-password flow is for.

### Revoke an invitation

```http
DELETE /api/v1/users/:id/invite
Authorization: Bearer <token>   (ADMIN+)
```

Deletes the pending token so the emailed link can no longer be redeemed.

## Update user

```http
PATCH /api/v1/users/:id
Authorization: Bearer <token>

{ "name": "New Name", "role": "admin" }
```

`ADMIN` cannot promote to `SUPER_ADMIN`. Only `SUPER_ADMIN` can modify other `SUPER_ADMIN` accounts.

## Deactivate user

```http
PATCH /api/v1/users/:id
{ "isActive": false }
```

Blocks login without deleting the account. All issued tokens remain valid until they expire.

## Delete user

```http
DELETE /api/v1/users/:id
Authorization: Bearer <token>
```

Permanently deletes the account. Audit log entries referencing this user are preserved with the user's name.

---

## Roles

```http
GET /api/v1/roles
```

Returns the four system roles: `SUPER_ADMIN`, `ADMIN`, `EDITOR`, `VIEWER`.

---

## API Tokens

### List tokens

```http
GET /api/v1/tokens
Authorization: Bearer <token>
```

### Create token

```http
POST /api/v1/tokens
Authorization: Bearer <token>

{
  "name": "Frontend delivery key",
  "type": "delivery",
  "expiresAt": "2027-01-01T00:00:00Z"
}
```

`type` is `delivery` (read-only, `X-Kast-Key`) or `admin` (full access at the specified `role`).

The plain token is returned **once** in the response. Store it securely — it is stored as a SHA-256 hash and cannot be retrieved again.

### Revoke token

```http
DELETE /api/v1/tokens/:id
Authorization: Bearer <token>
```

Takes effect immediately for all subsequent requests.

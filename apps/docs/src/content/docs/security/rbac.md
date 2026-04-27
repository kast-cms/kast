---
title: RBAC
description: Role-based access control in Kast CMS.
sidebar:
  order: 1
---

Every Kast API endpoint is protected by role-based access control (RBAC). Users are assigned a role, and each role grants a fixed set of permissions.

## Roles

| Role          | Level | Description                                                       |
| ------------- | ----- | ----------------------------------------------------------------- |
| `SUPER_ADMIN` | 4     | Full access — can manage users, roles, settings, plugins          |
| `ADMIN`       | 3     | Content + users + settings, but no billing or super-admin actions |
| `EDITOR`      | 2     | Create, update, and publish content; upload media                 |
| `VIEWER`      | 1     | Read-only access to content, media, and analytics                 |

Roles are hierarchical — a higher level includes all permissions of lower levels.

## How permissions are enforced

Every protected endpoint uses the `@RequirePermission` decorator backed by `RbacGuard`:

```ts
@Get(':id')
@RequirePermission('content:read')
async getEntry(@Param('id') id: string) { ... }
```

If the authenticated user's role does not have the required permission, the API returns `403 Forbidden`.

## Permission map

| Permission        | Minimum role |
| ----------------- | ------------ |
| `content:read`    | viewer       |
| `media:read`      | viewer       |
| `seo:read`        | viewer       |
| `audit:read`      | admin        |
| `content:write`   | editor       |
| `media:write`     | editor       |
| `seo:write`       | editor       |
| `webhooks:manage` | admin        |
| `forms:manage`    | admin        |
| `users:manage`    | admin        |
| `settings:manage` | admin        |
| `plugins:manage`  | super_admin  |

## Delivery API (public)

The delivery API (`X-Kast-Key` with a delivery token) bypasses RBAC entirely — it can only return `PUBLISHED` entries and has no write access. It is safe to use in frontend code.

## Assigning roles

Admins can change a user's role from the admin panel (Users section) or via the API:

```ts
await kast.users.update(userId, { role: 'editor' });
```

Only `SUPER_ADMIN` users can promote others to `SUPER_ADMIN`.

## Custom roles (roadmap)

Custom roles with granular per-resource permissions are planned for a future release.

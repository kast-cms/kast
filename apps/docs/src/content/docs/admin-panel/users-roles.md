---
title: Users & Roles
description: Manage users, assign roles, invite team members, and create API tokens.
---

User management is accessible to `ADMIN+` at **Settings → Users & Roles**.

## Roles

| Role          | Level | Can do                                           |
| ------------- | ----- | ------------------------------------------------ |
| `VIEWER`      | 1     | Read published content via delivery API          |
| `EDITOR`      | 2     | Create/edit/publish content, upload media        |
| `ADMIN`       | 3     | All editor + manage users, webhooks, audit log   |
| `SUPER_ADMIN` | 4     | All permissions + global settings, queue monitor |

Role checks are hierarchical — `ADMIN` implicitly has all `EDITOR` permissions.

## Inviting a user

1. Go to **Users** → **Invite User**.
2. Enter the email address.
3. Select a role.
4. Click **Send Invite**.

An invitation email is sent via the configured email transport. The link expires after 24 hours.

## Editing a user

Click a user row to open their profile:

- Change their display name
- Change their role (ADMIN cannot promote to SUPER_ADMIN)
- Deactivate the account (blocks login without deleting the record)
- Reset their password (sends a reset email)

:::note
A SUPER_ADMIN account cannot be modified by an ADMIN — only by another SUPER_ADMIN.
:::

## API tokens

Kast supports two token types for programmatic access:

### Delivery tokens

Read-only access to published content. Use for frontend apps.

1. Go to **Settings → API Tokens** → **New Token**.
2. Select type **Delivery**.
3. Optionally set an expiry date.
4. Copy the token — shown only once.

Use in requests via the `X-Kast-Key` header.

### Admin tokens

Full API access at a specified role level. Use for server-side scripts.

1. Go to **Settings → API Tokens** → **New Token**.
2. Select type **Admin** and choose the role level.
3. Copy the token — shown only once.

Use in requests via `Authorization: Bearer <token>`.

### Revoking tokens

Click **Revoke** on any token in the list. Revoked tokens are rejected immediately.

## Agent tokens

Agent tokens are a special type for AI agents (Claude, etc.) connecting via MCP. See [Agent Tokens](/mcp/agent-tokens/) for details.

## Connected OAuth accounts

Users can connect Google and GitHub accounts in their profile page. Once connected, they can sign in with either OAuth provider or their password.

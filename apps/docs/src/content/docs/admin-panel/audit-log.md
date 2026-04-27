---
title: Audit Log
description: Search, filter, and export every action taken in Kast — by humans and AI agents.
---

The audit log records every mutation in the system — who did what, when, and to which resource. Accessible to `ADMIN+` at **Audit Log** in the sidebar.

## What is logged

Every state-changing API call is captured:

| Category     | Actions                                                     |
| ------------ | ----------------------------------------------------------- |
| `content.*`  | created, updated, published, unpublished, trashed, restored |
| `media.*`    | uploaded, updated, deleted                                  |
| `auth.*`     | login, logout, password changed, OAuth linked               |
| `schema.*`   | content type created/updated/deleted, field added/removed   |
| `tokens.*`   | API token created, revoked                                  |
| `mcp.*`      | every MCP tool call, including dry-runs                     |
| `settings.*` | global settings updated                                     |
| `users.*`    | user invited, role changed, deactivated                     |

## Filter bar

| Filter          | Options                                          |
| --------------- | ------------------------------------------------ |
| Action          | Grouped dropdown: `content.*`, `media.*`, etc.   |
| Resource type   | ContentEntry, MediaFile, User, etc.              |
| Actor           | Search by name or email                          |
| Date range      | From / To pickers                                |
| AI actions only | Filters to rows where `agentTokenId IS NOT NULL` |
| Dry-run only    | Filters to MCP dry-run operations                |

## Event table

Each row shows:

- **Timestamp** — relative time (e.g. "3 minutes ago"), absolute on hover
- **Actor** — user avatar + name, or robot icon + agent name for AI
- **Action badge** — colour-coded: green = create, blue = read, amber = update, red = delete/trash, purple = MCP
- **Resource** — type and title, clickable if the resource still exists
- **IP address** — truncated
- **Dry-run badge** — when `isDryRun: true`

Click **Expand** on any row to see the full `before` / `after` JSON diff. Sensitive fields (passwords, tokens) are shown as `***`.

## Export

Click **Export CSV** to download the current filtered view (up to 10,000 rows). Columns: timestamp, actorName, actorEmail, agentName, action, resource, resourceId, ipAddress, isDryRun.

## Immutability

Audit records are append-only. The API returns `405 Method Not Allowed` on any DELETE attempt against `/api/v1/audit`. There is no UI to delete audit records.

Audit logs are retained indefinitely unless you configure a retention policy at the database level outside Kast.

## API

```bash
GET /api/v1/audit
  ?action=content.publish
  &userId=<id>
  &from=2026-01-01T00:00:00Z
  &to=2026-04-27T00:00:00Z
  &limit=50
  &cursor=<cursor>

GET /api/v1/audit/export?format=csv
```

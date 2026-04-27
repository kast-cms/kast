---
title: Audit Log API
description: Query and export the append-only audit trail.
---

Requires `ADMIN+`. The audit log is append-only — no DELETE endpoint exists.

## List audit events

```http
GET /api/v1/audit
Authorization: Bearer <token>
```

**Query parameters:**

| Param          | Type     | Description                                   |
| -------------- | -------- | --------------------------------------------- |
| `action`       | string   | Filter by action (e.g. `content.publish`)     |
| `resource`     | string   | Filter by resource type (e.g. `ContentEntry`) |
| `resourceId`   | string   | Filter by a specific resource ID              |
| `userId`       | string   | Filter by actor user ID                       |
| `agentTokenId` | string   | Filter by agent token ID                      |
| `from`         | ISO 8601 | Start of date range                           |
| `to`           | ISO 8601 | End of date range                             |
| `isDryRun`     | boolean  | Only dry-run MCP operations                   |
| `limit`        | number   | Page size (default 50, max 200)               |
| `cursor`       | string   | Pagination cursor                             |

**Response:**

```json
{
  "data": [
    {
      "id": "audit_...",
      "action": "content.publish",
      "resource": "ContentEntry",
      "resourceId": "clxyz...",
      "actor": { "id": "usr_...", "name": "Oday Bakkour", "email": "oday@example.com" },
      "agentTokenId": null,
      "agentName": null,
      "ipAddress": "1.2.3.x",
      "isDryRun": false,
      "before": null,
      "after": { "status": "PUBLISHED" },
      "createdAt": "2026-04-27T10:00:00Z"
    }
  ],
  "meta": { "total": 1203, "cursor": "audit_next..." }
}
```

## Export as CSV

```http
GET /api/v1/audit/export?format=csv
Authorization: Bearer <token>
```

All current filter params apply. Maximum 10,000 rows per export. Returns `text/csv`.

**Columns:** `timestamp`, `actorName`, `actorEmail`, `agentName`, `action`, `resource`, `resourceId`, `ipAddress`, `isDryRun`

## Immutability

```http
DELETE /api/v1/audit/:id
→ 405 Method Not Allowed
```

Audit records cannot be modified or deleted through the API.

## Action reference

| Prefix       | Actions                                                                |
| ------------ | ---------------------------------------------------------------------- |
| `content.*`  | created, updated, published, unpublished, trashed, restored, scheduled |
| `media.*`    | uploaded, updated, deleted                                             |
| `auth.*`     | login, logout, password_changed, oauth_linked                          |
| `schema.*`   | type_created, type_updated, type_deleted, field_added, field_removed   |
| `tokens.*`   | created, revoked                                                       |
| `mcp.*`      | tool_called (with `isDryRun` flag)                                     |
| `settings.*` | updated                                                                |
| `users.*`    | invited, role_changed, deactivated                                     |

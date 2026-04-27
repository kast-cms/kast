---
title: Trash API
description: List, restore, and permanently delete trashed content entries and media files.
---

## List trashed items

```http
GET /api/v1/trash
Authorization: Bearer <token>   (EDITOR+)
?resource=ContentEntry&limit=20&cursor=<cursor>
```

**Query params:**

| Param      | Values                      | Description             |
| ---------- | --------------------------- | ----------------------- |
| `resource` | `ContentEntry`, `MediaFile` | Filter by resource type |
| `limit`    | 1–100                       | Page size               |
| `cursor`   | string                      | Pagination cursor       |

**Response:**

```json
{
  "data": [
    {
      "id": "clxyz...",
      "resource": "ContentEntry",
      "resourceId": "entry_...",
      "title": "Hello World",
      "typeSlug": "blog-post",
      "trashedAt": "2026-04-20T10:00:00Z",
      "trashedBy": { "id": "...", "name": "Oday Bakkour" },
      "expiresAt": "2026-05-20T10:00:00Z"
    }
  ],
  "meta": { "total": 5, "cursor": null }
}
```

`expiresAt` is 30 days after `trashedAt`. Items are auto-deleted by the `kast.trash` cron job after this date.

## Restore

```http
POST /api/v1/trash/:id/restore
Authorization: Bearer <token>   (EDITOR+)
```

Sets entry status to `DRAFT`. Returns `200` with the restored resource.

## Permanent delete

```http
DELETE /api/v1/trash/:id
Authorization: Bearer <token>   (ADMIN+)
```

Irreversibly removes the record from the database.

## Bulk restore

```http
POST /api/v1/trash/bulk-restore
Authorization: Bearer <token>

{ "ids": ["id1", "id2"] }
```

## Bulk permanent delete

```http
POST /api/v1/trash/bulk-delete
Authorization: Bearer <token>   (ADMIN+)

{ "ids": ["id1", "id2"] }
```

## Auto-cleanup

The `kast.trash` BullMQ queue runs a cron job daily at midnight UTC. It permanently deletes all items where `trashedAt < NOW() - 30 days`. The cleanup count is logged to the audit log.

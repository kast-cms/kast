---
title: Content Entries API
description: CRUD, publish, schedule, version, and deliver content entries.
---

## List entries

```http
GET /api/v1/content-types/:typeSlug/entries
X-Kast-Key: <delivery-key>   (or Authorization: Bearer <token>)
```

**Query parameters:**

| Param    | Type   | Default          | Description                              |
| -------- | ------ | ---------------- | ---------------------------------------- |
| `status` | string | `PUBLISHED`      | Filter by status                         |
| `locale` | string | default locale   | Locale code                              |
| `limit`  | number | 20               | Page size (max 100)                      |
| `cursor` | string | —                | Pagination cursor from previous response |
| `sort`   | string | `createdAt:desc` | Field and direction                      |

**Response:**

```json
{
  "data": [
    {
      "id": "clxyz...",
      "status": "PUBLISHED",
      "locale": "en",
      "data": { "title": "Hello World", "slug": "hello-world" },
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-02T00:00:00Z",
      "publishedAt": "2026-01-02T00:00:00Z"
    }
  ],
  "meta": { "total": 42, "cursor": "clxyz2..." }
}
```

## Get entry

```http
GET /api/v1/content-types/:typeSlug/entries/:id
GET /api/v1/content-types/:typeSlug/entries/:id?locale=ar
```

## Create entry

Requires `EDITOR+`.

```http
POST /api/v1/content-types/:typeSlug/entries
Authorization: Bearer <token>
Content-Type: application/json

{
  "locale": "en",
  "data": {
    "title": "Hello World",
    "slug": "hello-world",
    "body": { "type": "doc", "content": [] }
  }
}
```

## Update entry

```http
PATCH /api/v1/content-types/:typeSlug/entries/:id
Authorization: Bearer <token>

{
  "locale": "en",
  "data": { "title": "Updated Title" }
}
```

## Publish

```http
POST /api/v1/content-types/:typeSlug/entries/:id/publish
Authorization: Bearer <token>
```

Sets `status = PUBLISHED`, records `content.publish` audit event, fires `content.published` webhook.

## Unpublish

```http
POST /api/v1/content-types/:typeSlug/entries/:id/unpublish
Authorization: Bearer <token>
```

Sets `status = ARCHIVED`.

## Schedule

```http
POST /api/v1/content-types/:typeSlug/entries/:id/schedule
Authorization: Bearer <token>

{ "scheduledAt": "2026-06-01T09:00:00Z" }
```

## Trash (soft-delete)

```http
DELETE /api/v1/content-types/:typeSlug/entries/:id
Authorization: Bearer <token>
```

## Version history

```http
GET /api/v1/content-types/:typeSlug/entries/:id/versions
Authorization: Bearer <token>
```

## Revert to version

```http
POST /api/v1/content-types/:typeSlug/entries/:id/versions/:versionId/revert
Authorization: Bearer <token>
```

## Bulk operations

```http
POST /api/v1/content-types/:typeSlug/entries/bulk
Authorization: Bearer <token>

{
  "action": "publish",   // "publish" | "trash" | "archive"
  "ids": ["id1", "id2", "id3"]
}
```

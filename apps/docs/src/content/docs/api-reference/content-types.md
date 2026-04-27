---
title: Content Types API
description: Create and manage content type schemas via the REST API.
---

Requires `ADMIN+` role for write operations. `VIEWER+` for reads.

## List content types

```http
GET /api/v1/content-types
Authorization: Bearer <token>
```

**Response:**

```json
{
  "data": [{ "name": "blog-post", "displayName": "Blog Post", "icon": "📝", "entryCount": 12 }]
}
```

## Get content type

```http
GET /api/v1/content-types/:name
Authorization: Bearer <token>
```

Returns the type with its full field list.

## Create content type

```http
POST /api/v1/content-types
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "blog-post",
  "displayName": "Blog Post",
  "description": "Articles for the blog",
  "icon": "📝"
}
```

`name` must be lowercase, alphanumeric with hyphens, unique.

## Update content type

```http
PATCH /api/v1/content-types/:name
Authorization: Bearer <token>
Content-Type: application/json

{ "displayName": "Blog Article", "description": "Updated description" }
```

`name` (the slug) cannot be changed after creation.

## Delete content type

```http
DELETE /api/v1/content-types/:name
Authorization: Bearer <token>
```

Fails if any entries exist. Returns `409 Conflict` with entry count.

## Add field

```http
POST /api/v1/content-types/:name/fields
Authorization: Bearer <token>
Content-Type: application/json

{
  "label": "Title",
  "key": "title",
  "type": "short_text",
  "required": true,
  "localized": true
}
```

**Field types:** `short_text`, `long_text`, `rich_text`, `number`, `boolean`, `date`, `media`, `relation`, `json`

## Update field

```http
PATCH /api/v1/content-types/:name/fields/:fieldKey
Authorization: Bearer <token>

{ "label": "Post Title", "required": false }
```

`key` and `type` are immutable.

## Delete field

```http
DELETE /api/v1/content-types/:name/fields/:fieldKey
Authorization: Bearer <token>
```

Permanently removes the field and all stored values across all entries.

## Reorder fields

```http
PATCH /api/v1/content-types/:name/fields/reorder
Authorization: Bearer <token>

{ "order": ["title", "slug", "body", "publishedAt"] }
```

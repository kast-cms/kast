---
title: Your First Content Entry
description: Create, edit, publish, and schedule content entries.
sidebar:
  order: 4
---

A **content entry** is one instance of a content type — e.g. a single blog post.

## Creating an entry

### Via the Admin Panel

1. Click the content type name in the sidebar (e.g. **Blog Post**).
2. Click **New Entry**.
3. Fill in the fields defined by the content type.
4. Click **Save Draft** to save without publishing.

### Via the API

```bash
POST /api/v1/content-types/blog-post/entries
Authorization: Bearer <token>

{
  "locale": "en",
  "data": {
    "title": "Hello World",
    "slug": "hello-world",
    "body": { "type": "doc", "content": [] }
  }
}
```

Response:

```json
{
  "data": {
    "id": "clxyz...",
    "status": "DRAFT",
    "locale": "en",
    "data": { "title": "Hello World", "slug": "hello-world" },
    "createdAt": "2026-01-01T00:00:00Z"
  }
}
```

## Entry status lifecycle

```
DRAFT → PUBLISHED → ARCHIVED
  ↓
SCHEDULED (auto-publishes at scheduledAt)
  ↓
TRASHED (soft-deleted, recoverable for 30 days)
```

See [Status Lifecycle](/concepts/status-lifecycle/) for full details.

## Publishing an entry

```bash
POST /api/v1/content-types/blog-post/entries/:id/publish
Authorization: Bearer <token>
```

Or click **Publish** in the top-right of the entry editor.

## Scheduling a publish

```bash
POST /api/v1/content-types/blog-post/entries/:id/schedule
Authorization: Bearer <token>

{
  "scheduledAt": "2026-06-01T09:00:00Z"
}
```

The entry status becomes `SCHEDULED`. A BullMQ job fires at the specified time and sets it to `PUBLISHED`.

## Updating an entry

Only `data` fields and `status` can be updated via PATCH:

```bash
PATCH /api/v1/content-types/blog-post/entries/:id
Authorization: Bearer <token>

{
  "data": { "title": "Updated Title" }
}
```

Every update creates a new version. Previous versions are accessible for 30 days (or the configured `content.versionRetention` count).

## Fetching published entries (Delivery API)

The delivery API is public — no auth required for `PUBLISHED` entries:

```bash
GET /api/v1/content-types/blog-post/entries?status=PUBLISHED&locale=en
```

Filter, paginate, and sort:

```
?status=PUBLISHED
&locale=en
&limit=10
&cursor=<cursor>
&sort=createdAt:desc
```

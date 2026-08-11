---
title: Content Entries API
description: CRUD, publish, schedule, version, and deliver content entries.
---

These are the **authenticated** content management endpoints — they require a Bearer token and let you read entries in any status (draft, scheduled, archived). To fetch **published** content from a public frontend, use the [Delivery API](/api-reference/delivery/) (`/api/v1/delivery/*`) instead.

## List entries

```http
GET /api/v1/content-types/:typeSlug/entries
Authorization: Bearer <token>
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

## Unarchive

```http
POST /api/v1/content-types/:typeSlug/entries/:id/unarchive
Authorization: Bearer <token>
```

Returns an archived entry to `DRAFT`. This is **not** the same as restoring from
the trash: an entry that is in the trash is refused with `409`, naming
`POST /api/v1/trash/content/:id/restore` as the route to use instead.

`POST .../entries/:id/restore` is a deprecated alias of this route, kept working
for existing clients.

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

Three separate routes, one per action:

```http
POST /api/v1/content-types/:typeSlug/entries/bulk/trash
POST /api/v1/content-types/:typeSlug/entries/bulk/publish
POST /api/v1/content-types/:typeSlug/entries/bulk/unpublish
Authorization: Bearer <token>

{ "ids": ["id1", "id2", "id3"] }
```

At most **100 ids** per request; duplicates are collapsed.

### Not atomic

Every id runs through the same single-entry path as the individual route, so
each one is subject to the content-type binding check, the schema gate and the
SEO gate on its own. **A failure does not roll back the ids that succeeded** —
one entry blocked by the SEO gate must not undo a publish that was already
valid. The response reports each id separately and the status is always `200`:

```json
{
  "data": {
    "results": [
      { "id": "id1", "ok": true },
      {
        "id": "id2",
        "ok": false,
        "error": {
          "status": 422,
          "code": "UNPROCESSABLE_ENTITY",
          "message": "Meta title is missing"
        }
      }
    ],
    "succeeded": 1,
    "failed": 1
  }
}
```

Apply an optimistic UI update only to the ids reported with `ok: true`.

## Slugs

Each entry carries one slug per locale, and it is the URL identity the Delivery
API looks entries up by.

- Precedence on write: an explicit `slug` on the request body wins, then
  `data.slug`, then a generated `<typeSlug>-<random>` fallback.
- Stored slugs are normalised: NFKC, lower-cased, every run of non-alphanumeric
  characters folded to a single hyphen, trimmed, capped at 200 characters.
  Unicode letters and digits survive, so Arabic slugs are preserved.
- An explicit slug that normalises to nothing is a `400` rather than being
  silently replaced.
- `(localeCode, slug)` is unique in the database; a collision is a `409`.
- `slug` may also be sent on update, including on its own.

A `slug` _field_ declared on the content type is ordinary content and is stored
exactly as validated — only the locale's slug column is normalised.

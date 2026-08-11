---
title: Trash API
description: List, restore, and permanently delete trashed content entries, media files, users and forms.
---

Four models are recoverable: `content`, `media`, `user` and `form`. The model is
part of the path on every write route.

Trashed records are kept for **30 days**, then removed by the `kast.trash` cron
job. Each purged record is written to the audit log with no actor and
`{ reason: "retention" }`.

## List trashed items

```http
GET /api/v1/trash
Authorization: Bearer <token>   (ADMIN+)
?model=content&limit=20&cursor=<cursor>
```

**Query params:**

| Param    | Values                             | Description                         |
| -------- | ---------------------------------- | ----------------------------------- |
| `model`  | `content`, `media`, `user`, `form` | Restrict to one model; omit for all |
| `limit`  | 1–100 (default 20)                 | Page size                           |
| `cursor` | string                             | Opaque cursor from `nextCursor`     |

**Response:**

```json
{
  "items": [
    {
      "id": "clxyz...",
      "model": "content",
      "name": "hello-world",
      "trashedAt": "2026-04-20T10:00:00Z",
      "trashedByUserId": "usr_...",
      "trashedByName": "Oday Bakkour",
      "daysUntilDeletion": 27
    }
  ],
  "total": 5,
  "nextCursor": "MjAyNi0wNC0yMFQxMDowMDowMFp8Y2x4eXo"
}
```

`trashedByName` is resolved for the returned page and is `null` when the delete
path recorded no actor or that account is itself gone.

### Paging

`nextCursor` is a keyset cursor spanning **every** model in the listing, not a
row id. Pass it back as `cursor` to continue; `null` means the last page. A
cursor the API did not issue is rejected with `400` rather than silently paging
from the wrong place — slicing a concatenation instead would let whichever model
is queried first fill the page and strand the others.

## Restore

```http
POST /api/v1/trash/:model/:id/restore
Authorization: Bearer <token>   (ADMIN+)
```

Returns `200`. Restoring:

- **content** — clears `trashedAt` and returns the entry to `DRAFT`.
- **user** — clears `trashedAt` and sets `isActive: true`, because trashing a
  user also deactivates the account. A user who was already deactivated _before_
  being trashed therefore comes back active; the schema records no prior state.
- **media**, **form** — clears `trashedAt`.

Restoring something that is not in the trash is a `404`.

:::note
This is distinct from `POST /api/v1/content-types/:typeSlug/entries/:id/unarchive`,
which returns an _archived_ (not trashed) entry to draft.
:::

## Permanent delete

```http
DELETE /api/v1/trash/:model/:id
Authorization: Bearer <token>   (SUPER_ADMIN only)
```

Returns `204`. Irreversible.

For `media` this also deletes the stored object, its thumbnails and the
pre-optimisation original — permanently deleting a file releases its bytes,
while moving it to the trash deliberately keeps them so a restore is not broken.

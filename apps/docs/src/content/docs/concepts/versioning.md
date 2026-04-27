---
title: Versioning & Revert
description: Every save creates a version snapshot. Browse history and revert to any previous state.
---

Kast automatically creates a version snapshot every time a content entry is saved. No configuration required.

## How versioning works

On every `PATCH /api/v1/content-types/:typeSlug/entries/:id` call:

1. The current entry state is snapshotted as a `ContentEntryVersion` record.
2. The entry is updated with the new data.
3. The version is linked to the entry and the editor who made the change.

Each version stores:

- The full `data` JSON at that point in time
- The `status` at save time
- The author (`userId`)
- The `createdAt` timestamp

## Listing versions

```bash
GET /api/v1/content-types/:typeSlug/entries/:id/versions
Authorization: Bearer <token>
```

Response:

```json
{
  "data": [
    {
      "id": "ver_001",
      "version": 5,
      "createdAt": "2026-04-20T14:00:00Z",
      "author": { "id": "...", "name": "Oday Bakkour" },
      "data": { "title": "Hello World (v5)" }
    },
    {
      "id": "ver_002",
      "version": 4,
      "createdAt": "2026-04-19T10:30:00Z",
      "author": { "id": "...", "name": "Oday Bakkour" },
      "data": { "title": "Hello World (v4)" }
    }
  ]
}
```

## Reverting to a version

```bash
POST /api/v1/content-types/:typeSlug/entries/:id/versions/:versionId/revert
Authorization: Bearer <token>
```

This creates a **new version** (preserving history) with the data from the target version. It does not overwrite history.

## Version retention

By default, Kast retains all versions. You can cap the number in **Global Settings → Content**:

- `content.versionRetention = 10` — keep only the 10 most recent versions per entry
- `content.versionRetention = 0` — retain indefinitely (default)

When the cap is exceeded, the oldest version is deleted on the next save.

## Admin panel

In the content editor, click the **History** tab (clock icon) to:

- Browse all versions with timestamps and authors
- Preview the content at any version
- Click **Restore this version** to revert

## SDK usage

```ts
// List versions
const { data: versions } = await kast.versions.list('blog-post', entryId);

// Get a specific version
const { data: version } = await kast.versions.get('blog-post', entryId, versionId);

// Revert
await kast.versions.revert('blog-post', entryId, versionId);
```

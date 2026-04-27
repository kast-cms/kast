---
title: Trash & Recovery
description: Soft-delete content entries and media, then restore or permanently delete within 30 days.
---

Kast never hard-deletes content immediately. Deleting an entry moves it to the **Trash**, where it stays for 30 days. During that window you can restore it to `DRAFT` or permanently delete it.

## Trashing an entry

```bash
DELETE /api/v1/content-types/:typeSlug/entries/:id
Authorization: Bearer <token>
```

This sets `status = TRASHED` and records a `content.trash` audit event. The entry is hidden from all delivery API responses and the main content list.

## Viewing trashed items

```bash
GET /api/v1/trash
Authorization: Bearer <token>
```

Returns all trashed entries and media files, with `trashedAt` timestamps and the user who trashed them.

Filter by resource type:

```bash
GET /api/v1/trash?resource=ContentEntry
GET /api/v1/trash?resource=MediaFile
```

## Restoring an entry

```bash
POST /api/v1/trash/:id/restore
Authorization: Bearer <token>
```

Sets `status = DRAFT`. The entry reappears in the content list. All its versions and SEO metadata are preserved.

## Permanently deleting

```bash
DELETE /api/v1/trash/:id
Authorization: Bearer <token>
```

Permanently removes the entry from the database. This is irreversible.

:::caution
Permanently deleted entries cannot be recovered. The associated media files are **not** deleted — only the content record is removed.
:::

## Auto-cleanup

A daily `kast.trash` BullMQ cron job permanently deletes items that have been in the trash for more than 30 days. The job runs at midnight UTC.

## Admin panel

Navigate to **Trash** in the sidebar to see all trashed items. Each row shows:

- Resource type (entry / media file)
- Content type and entry title
- Who trashed it and when
- Time remaining before auto-deletion

Click **Restore** or **Delete permanently** on each row.

## Bulk operations

```bash
# Bulk restore
POST /api/v1/trash/bulk-restore
{ "ids": ["id1", "id2", "id3"] }

# Bulk permanent delete
POST /api/v1/trash/bulk-delete
{ "ids": ["id1", "id2", "id3"] }
```

## SDK usage

```ts
// List trash
const { data: items } = await kast.trash.list();

// Restore
await kast.trash.restore(itemId);

// Permanently delete
await kast.trash.deletePermanently(itemId);
```

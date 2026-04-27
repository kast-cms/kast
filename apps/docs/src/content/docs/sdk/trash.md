---
title: Trash
description: List, restore, and permanently delete trashed items with the SDK.
sidebar:
  order: 12
---

Deleted content entries, media files, users, and forms move to the trash. Items are permanently deleted automatically after 30 days.

## List trash

```ts
const { items, total } = await kast.trash.list({ limit: 50 });
```

### Filter by model

```ts
const { items } = await kast.trash.list({ model: 'content' });
// model: 'content' | 'media' | 'user' | 'form'
```

## Restore an item

```ts
await kast.trash.restore('content', entryId);
await kast.trash.restore('media', fileId);
await kast.trash.restore('form', formId);
```

## Permanently delete

Immediately removes the item — cannot be undone.

```ts
await kast.trash.permanentDelete('content', entryId);
```

---

## TrashedItem type

```ts
interface TrashedItem {
  id: string;
  model: 'content' | 'media' | 'user' | 'form';
  name: string;
  trashedAt: string;
  trashedByUserId: string | null;
  daysUntilDeletion: number;
}
```

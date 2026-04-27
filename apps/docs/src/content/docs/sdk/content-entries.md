---
title: Content Entries
description: CRUD, publish, schedule, and filter content entries with the SDK.
sidebar:
  order: 4
---

## List entries

```ts
const { data: posts, meta } = await kast.content.list('blog-post', {
  status: 'PUBLISHED',
  locale: 'en',
  limit: 10,
  cursor: undefined,
  sort: 'createdAt:desc',
});
// meta.cursor — pass to next call for pagination
```

## Get an entry

```ts
const { data: post } = await kast.content.get('blog-post', entryId, { locale: 'en' });
```

## Create an entry

```ts
const { data: post } = await kast.content.create('blog-post', {
  locale: 'en',
  data: {
    title: 'Hello World',
    slug: 'hello-world',
    body: { type: 'doc', content: [] },
  },
});
```

## Update an entry

```ts
const { data: post } = await kast.content.update('blog-post', entryId, {
  locale: 'en',
  data: { title: 'Updated Title' },
});
```

## Publish

```ts
await kast.content.publish('blog-post', entryId);
```

## Unpublish

```ts
await kast.content.unpublish('blog-post', entryId);
```

## Schedule

```ts
await kast.content.schedule('blog-post', entryId, {
  scheduledAt: '2026-06-01T09:00:00Z',
});
```

## Trash

```ts
await kast.content.trash('blog-post', entryId);
```

## Bulk operations

```ts
await kast.content.bulk('blog-post', {
  action: 'publish',
  ids: ['id1', 'id2', 'id3'],
});
```

## Pagination example

```ts
async function fetchAllPosts() {
  const posts = [];
  let cursor: string | undefined;

  do {
    const { data, meta } = await kast.content.list('blog-post', {
      status: 'PUBLISHED',
      limit: 100,
      cursor,
    });
    posts.push(...data);
    cursor = meta.cursor ?? undefined;
  } while (cursor);

  return posts;
}
```

## Entry type

```ts
interface ContentEntrySummary {
  id: string;
  status: 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED' | 'TRASHED';
  locale: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  scheduledAt?: string;
}
```

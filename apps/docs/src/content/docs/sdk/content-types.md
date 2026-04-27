---
title: Content Types
description: Manage content type schemas with the SDK.
sidebar:
  order: 3
---

## List content types

```ts
const { data: types } = await kast.contentTypes.list();
// types: ContentTypeSummary[]
```

## Get a content type

```ts
const { data: type } = await kast.contentTypes.get('blog-post');
// type: ContentTypeDetail — includes fields array
```

## Create a content type

```ts
const { data: type } = await kast.contentTypes.create({
  name: 'blog-post',
  displayName: 'Blog Post',
  description: 'Articles for the blog',
  icon: '📝',
});
```

## Update a content type

```ts
const { data: type } = await kast.contentTypes.update('blog-post', {
  displayName: 'Blog Article',
});
```

## Delete a content type

```ts
await kast.contentTypes.delete('blog-post');
// Throws if entries exist
```

## Add a field

```ts
const { data: field } = await kast.contentTypes.addField('blog-post', {
  label: 'Title',
  key: 'title',
  type: 'short_text',
  required: true,
  localized: true,
});
```

## Update a field

```ts
await kast.contentTypes.updateField('blog-post', 'title', {
  label: 'Post Title',
  required: false,
});
```

## Delete a field

```ts
await kast.contentTypes.deleteField('blog-post', 'title');
```

## Reorder fields

```ts
await kast.contentTypes.reorderFields('blog-post', {
  order: ['title', 'slug', 'body', 'publishedAt'],
});
```

## Types

```ts
interface ContentTypeSummary {
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  entryCount: number;
}

interface ContentTypeDetail extends ContentTypeSummary {
  fields: ContentField[];
  createdAt: string;
  updatedAt: string;
}

interface ContentField {
  key: string;
  label: string;
  type:
    | 'short_text'
    | 'long_text'
    | 'rich_text'
    | 'number'
    | 'boolean'
    | 'date'
    | 'media'
    | 'relation'
    | 'json';
  required: boolean;
  localized: boolean;
  order: number;
}
```

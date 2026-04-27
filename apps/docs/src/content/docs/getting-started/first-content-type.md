---
title: Your First Content Type
description: Model your content with fields, validation, and display options.
sidebar:
  order: 3
---

A **content type** is a schema — it defines the shape of entries you can create. Think of it as a database table definition, but managed through the UI or API.

## Creating a content type

### Via the Admin Panel

1. Navigate to **Content Types** → **New Content Type**.
2. Fill in:
   - **Name** — the slug used in API URLs (e.g. `blog-post`)
   - **Display Name** — shown in the admin sidebar (e.g. `Blog Post`)
   - **Description** — optional, shown in the content type list
   - **Icon** — emoji or icon name for the sidebar

### Via the API

```bash
POST /api/v1/content-types
Authorization: Bearer <token>

{
  "name": "blog-post",
  "displayName": "Blog Post",
  "description": "Articles for the blog",
  "icon": "📝"
}
```

## Field types

| Type       | Key          | Use for                                   |
| ---------- | ------------ | ----------------------------------------- |
| Short Text | `short_text` | Titles, slugs, names                      |
| Long Text  | `long_text`  | Summaries, excerpts                       |
| Rich Text  | `rich_text`  | Body content (stored as ProseMirror JSON) |
| Number     | `number`     | Prices, counts, ratings                   |
| Boolean    | `boolean`    | Published flags, toggles                  |
| Date       | `date`       | Published at, event dates                 |
| Media      | `media`      | Single image or file reference            |
| Relation   | `relation`   | Link to another content type              |
| JSON       | `json`       | Arbitrary structured data                 |

## Adding a field

### Via the Admin Panel

In the content type editor, click **Add Field**, choose a type, and configure:

- **Label** — shown above the input in the editor
- **Key** — the property name in the entry's `data` object
- **Required** — validation rule; entry cannot be saved without it
- **Localized** — whether this field can have per-locale values

### Via the API

```bash
POST /api/v1/content-types/blog-post/fields
Authorization: Bearer <token>

{
  "label": "Title",
  "key": "title",
  "type": "short_text",
  "required": true,
  "localized": true
}
```

## Field ordering

Drag fields in the admin UI to reorder them. The display order affects the content editor layout. Reorder via API:

```bash
PATCH /api/v1/content-types/blog-post/fields/reorder
Authorization: Bearer <token>

{
  "order": ["title", "slug", "body", "publishedAt"]
}
```

## Example: Blog Post type

```json
{
  "name": "blog-post",
  "displayName": "Blog Post",
  "fields": [
    { "key": "title", "type": "short_text", "required": true, "localized": true },
    { "key": "slug", "type": "short_text", "required": true, "localized": false },
    { "key": "excerpt", "type": "long_text", "required": false, "localized": true },
    { "key": "body", "type": "rich_text", "required": false, "localized": true },
    { "key": "coverImage", "type": "media", "required": false, "localized": false },
    { "key": "publishedAt", "type": "date", "required": false, "localized": false }
  ]
}
```

---
title: Content Modeling
description: Design your content schema with content types, fields, and relations.
---

Content modeling is the process of defining the structure of your content before you write it. In Kast, everything starts with a **content type**.

## Content types

A content type is a named schema with a set of typed fields. The `name` becomes the URL slug used in all API calls.

```
Content Type: blog-post
  Fields:
    title       short_text  required localized
    slug        short_text  required
    body        rich_text   localized
    coverImage  media
    publishedAt date
```

You can have as many content types as your project needs — blog posts, products, authors, categories, pages, FAQs, changelog entries, etc.

## Field types

| Type         | Stored as         | Notes                                                |
| ------------ | ----------------- | ---------------------------------------------------- |
| `short_text` | `VARCHAR`         | Single-line, max 255 chars                           |
| `long_text`  | `TEXT`            | Multi-line plain text                                |
| `rich_text`  | `JSONB`           | ProseMirror document — rendered as HTML by frontends |
| `number`     | `DECIMAL`         | Integer or float                                     |
| `boolean`    | `BOOLEAN`         | `true` / `false`                                     |
| `date`       | `TIMESTAMPTZ`     | ISO 8601 datetime                                    |
| `media`      | `TEXT` (media ID) | Reference to a `MediaFile` record                    |
| `relation`   | `TEXT` (entry ID) | Reference to another content entry                   |
| `json`       | `JSONB`           | Arbitrary JSON blob                                  |

## Localized fields

Mark a field as **localized** to store separate values per locale. A non-localized field has one value shared across all locales.

```json
{
  "locale": "ar",
  "data": {
    "title": "مرحباً بالعالم",
    "slug": "hello-world"
  }
}
```

`slug` is not localized — it stays `hello-world` in all locales. `title` is localized — each locale has its own value.

## Relations

A `relation` field stores another entry's ID. Fetch the related entry separately, or use the SDK's `.get()` method to resolve it:

```ts
const { data: post } = await kast.content.get('blog-post', id);
const authorId = post.data.author as string;
const { data: author } = await kast.content.get('author', authorId);
```

## Required vs optional fields

Mark fields as `required: true` to enforce server-side validation. Attempting to save an entry without a required field returns:

```json
{
  "statusCode": 400,
  "error": "VALIDATION_ERROR",
  "details": [{ "field": "title", "message": "title is required" }]
}
```

## Content type API

```bash
# List all types
GET  /api/v1/content-types

# Get one type with fields
GET  /api/v1/content-types/:name

# Create
POST /api/v1/content-types

# Update display name / description
PATCH /api/v1/content-types/:name

# Delete (only if no entries exist)
DELETE /api/v1/content-types/:name

# Add a field
POST /api/v1/content-types/:name/fields

# Reorder fields
PATCH /api/v1/content-types/:name/fields/reorder
```

---
title: Content Types
description: Create and manage content type schemas from the admin panel.
---

The **Content Types** page (accessible to `ADMIN+`) is where you define the structure of your content.

## Creating a content type

1. Click **Content Types** → **New Content Type**.
2. Enter a **Name** (becomes the API slug, e.g. `blog-post`).
3. Enter a **Display Name** shown in the sidebar (e.g. `Blog Post`).
4. Optionally add a description and icon.
5. Click **Create**.

The new type appears in the sidebar immediately.

## Adding fields

In the content type editor, click **Add Field**:

1. Choose a **field type** (short text, rich text, media, etc.).
2. Enter a **label** and **key** (the property name in entry data).
3. Toggle **Required** and **Localized** as needed.
4. Click **Add Field**.

Drag rows to reorder fields — the order determines the layout in the content editor.

## Editing a field

Click the pencil icon on a field row to edit its label, required/localized flags, or description. The field `key` and `type` cannot be changed after creation (to preserve data integrity).

## Deleting a field

Click the trash icon. This is only allowed if **no entries exist** for the content type, or if the field is optional and you confirm data loss.

:::caution
Deleting a field removes all stored values for that field from every existing entry. This cannot be undone.
:::

## Deleting a content type

Click the **Delete** button on the content type list. This requires either zero entries or an explicit confirmation. All entries, versions, and SEO records for the type are permanently deleted.

## Content type list

The list view shows each content type with:

- Name and slug
- Number of published entries
- Number of total entries (including drafts)
- Last updated timestamp

Click a type name to open its schema editor, or click the entry count to jump directly to the content list for that type.

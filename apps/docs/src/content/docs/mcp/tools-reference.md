---
title: Tools Reference
description: All 15 MCP tools available in the Kast MCP server.
sidebar:
  order: 3
---

The Kast MCP server exposes 15 tools across three groups.

## Content entries (6 tools)

| Tool                    | Min role | Dry-run | Description                                        |
| ----------------------- | -------- | ------- | -------------------------------------------------- |
| `list_content_entries`  | viewer   | no      | List entries for a type with filter and pagination |
| `get_content_entry`     | viewer   | no      | Get a single entry with all locale data            |
| `create_content_entry`  | editor   | **yes** | Create a new entry (status = DRAFT)                |
| `update_content_entry`  | editor   | **yes** | Update entry fields by entry ID                    |
| `publish_content_entry` | editor   | no      | Publish a content entry                            |
| `delete_content_entry`  | admin    | no      | Soft-delete (trash) a content entry                |

## Content types (4 tools)

| Tool                  | Min role | Dry-run | Description                                     |
| --------------------- | -------- | ------- | ----------------------------------------------- |
| `list_content_types`  | viewer   | no      | List all content type definitions               |
| `get_content_type`    | viewer   | no      | Get a single content type with its fields       |
| `create_content_type` | admin    | **yes** | Create a new content type with fields           |
| `update_content_type` | admin    | **yes** | Update a content type's name/description/fields |

## Media, SEO, and audit (5 tools)

| Tool             | Min role | Dry-run | Description                                        |
| ---------------- | -------- | ------- | -------------------------------------------------- |
| `list_media`     | viewer   | no      | List media files with optional folder filter       |
| `get_media_file` | viewer   | no      | Get metadata for a single media file               |
| `get_seo_score`  | viewer   | no      | Get the latest SEO score and issues for an entry   |
| `validate_seo`   | editor   | no      | Trigger SEO validation job and return queue status |
| `get_audit_log`  | admin    | no      | Query the audit log with optional filters          |

---

## Tool input schemas

### list_content_entries

```json
{
  "typeSlug": "blog-post",
  "limit": 20,
  "cursor": "...",
  "locale": "en"
}
```

### get_content_entry

```json
{
  "typeSlug": "blog-post",
  "entryId": "cm...",
  "locale": "en"
}
```

### create_content_entry

```json
{
  "typeSlug": "blog-post",
  "locale": "en",
  "data": {
    "title": "Hello World",
    "slug": "hello-world",
    "body": "Content here..."
  }
}
```

### update_content_entry

```json
{
  "typeSlug": "blog-post",
  "entryId": "cm...",
  "data": { "title": "Updated title" },
  "status": "DRAFT"
}
```

### publish_content_entry

```json
{
  "typeSlug": "blog-post",
  "entryId": "cm..."
}
```

### delete_content_entry

```json
{
  "typeSlug": "blog-post",
  "entryId": "cm..."
}
```

### get_content_type / create_content_type / update_content_type

```json
{ "name": "blog-post" }
{ "name": "product", "displayName": "Product", "description": "E-commerce product", "icon": "ShoppingCart" }
```

### get_seo_score / validate_seo

```json
{ "entryId": "cm..." }
```

### get_audit_log

```json
{
  "action": "content.published",
  "resource": "ContentEntry",
  "userId": "...",
  "from": "2025-01-01T00:00:00Z",
  "to": "2025-12-31T23:59:59Z",
  "limit": 50
}
```

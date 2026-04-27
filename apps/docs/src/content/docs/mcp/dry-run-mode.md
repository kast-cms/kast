---
title: Dry-Run Mode
description: Preview write operations before they execute using dry-run mode.
sidebar:
  order: 4
---

Write tools that support dry-run mode can preview what would happen without actually changing any data. This is useful when asking an AI to draft content or restructure types — you can review the proposed changes before committing them.

## Which tools support dry-run?

| Tool                    | Dry-run supported     |
| ----------------------- | --------------------- |
| `create_content_entry`  | yes                   |
| `update_content_entry`  | yes                   |
| `create_content_type`   | yes                   |
| `update_content_type`   | yes                   |
| All read tools          | N/A — no side effects |
| `publish_content_entry` | no                    |
| `delete_content_entry`  | no                    |
| `validate_seo`          | no                    |

## How to trigger dry-run

Pass `"dryRun": true` in the tool input when calling via the JSON-RPC endpoint:

```json
{
  "method": "tools/call",
  "params": {
    "name": "create_content_entry",
    "arguments": {
      "typeSlug": "blog-post",
      "locale": "en",
      "data": {
        "title": "My Draft Post",
        "slug": "my-draft-post"
      },
      "dryRun": true
    }
  }
}
```

The API validates the input and returns what _would_ be created, but nothing is written to the database.

## Asking Claude to use dry-run

You can instruct Claude to preview changes before committing them:

> "Create a new blog post about Kast plugins. Use dry-run mode first so I can review it before it's saved."

Claude will call `create_content_entry` with `dryRun: true`, show you the proposed entry, and wait for your confirmation before calling it again without dry-run.

## Dry-run response

A dry-run response looks identical to a real response, but includes a `dryRun: true` flag:

```json
{
  "dryRun": true,
  "data": {
    "id": "(not yet created)",
    "typeSlug": "blog-post",
    "status": "DRAFT",
    "data": {
      "title": "My Draft Post",
      "slug": "my-draft-post"
    }
  }
}
```

---
title: MCP Server
description: Connect AI agents to Kast via the Model Context Protocol Streamable HTTP endpoint.
---

Kast exposes a built-in [Model Context Protocol](https://modelcontextprotocol.io) server. AI agents use it to read and write CMS content under full RBAC and audit control. Connect to `http://localhost:3000/api/v1/mcp` with an agent token.

## Transport

`/api/v1/mcp` is a single stateless Streamable HTTP endpoint. It supports current MCP protocol negotiation and the 2025 stateless protocol. POST carries JSON-RPC requests; GET is reserved for protocol streams and subscriptions.

All requests require a valid `kastagent_...` Bearer token. Human JWTs and ordinary API tokens are rejected.

## JSON-RPC methods

| Method       | Description                             |
| ------------ | --------------------------------------- |
| `initialize` | Handshake — returns server capabilities |
| `tools/list` | List all available tools                |
| `tools/call` | Execute a tool                          |

## Tool list

Kast exposes 15 built-in tools:

### Content Entry Tools

| Tool                      | Role   | Dry-runable | Description                                  |
| ------------------------- | ------ | ----------- | -------------------------------------------- |
| `list_content_entries`    | viewer | No          | List entries with filter and pagination      |
| `get_content_entry`       | viewer | No          | Get a single entry with all locale data      |
| `create_content_entry`    | editor | **Yes**     | Create a new entry (status = DRAFT)          |
| `update_content_entry`    | editor | **Yes**     | Update entry fields or status                |
| `publish_content_entry`   | editor | **Yes**     | Publish an entry after content and SEO gates |
| `unpublish_content_entry` | editor | **Yes**     | Return a published entry to draft            |
| `delete_content_entry`    | admin  | **Yes**     | Soft-delete (trash) an entry                 |

### Content Type Tools

| Tool                     | Role   | Dry-runable | Description                        |
| ------------------------ | ------ | ----------- | ---------------------------------- |
| `list_content_types`     | viewer | No          | List all content type definitions  |
| `get_content_type`       | viewer | No          | Get a content type with its fields |
| `create_content_type`    | admin  | **Yes**     | Create a new content type          |
| `update_content_type`    | admin  | **Yes**     | Update a content type              |
| `add_content_type_field` | admin  | **Yes**     | Add a field to an existing type    |

### Media, SEO & Audit Tools

| Tool                    | Role   | Dry-runable | Description                               |
| ----------------------- | ------ | ----------- | ----------------------------------------- |
| `list_media`            | viewer | No          | List media files                          |
| `get_media_file`        | viewer | No          | Get metadata for a single media file      |
| `upload_media_from_url` | editor | **Yes**     | Fetch a remote file and store it as media |
| `get_seo_score`         | viewer | No          | Get the SEO score and issues for an entry |
| `validate_seo`          | editor | **Yes**     | Trigger SEO validation job                |
| `create_redirect`       | editor | **Yes**     | Create an SEO redirect                    |
| `get_audit_log`         | admin  | No          | Query the audit log with filters          |

### Plugin & User Tools

| Tool             | Role  | Dry-runable | Description                                     |
| ---------------- | ----- | ----------- | ----------------------------------------------- |
| `list_plugins`   | admin | No          | List registered plugins and their enabled state |
| `enable_plugin`  | admin | **Yes**     | Enable a registered plugin on this API process  |
| `disable_plugin` | admin | **Yes**     | Disable a plugin on this API process            |
| `invite_user`    | admin | **Yes**     | Invite a user by email with roles               |

## Example: tools/call

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "list_content_entries",
    "arguments": {
      "typeSlug": "blog-post",
      "limit": 5,
      "locale": "en"
    }
  }
}
```

## Dry-run mode

Add `"dryRun": true` to any tool call that supports it:

```json
{
  "params": {
    "name": "create_content_entry",
    "arguments": {
      "typeSlug": "blog-post",
      "data": { "title": "Test Post" },
      "dryRun": true
    }
  }
}
```

Returns what would have been created without writing to the database. Logged to the audit log with `isDryRun: true`.

See [Dry-run Mode](/mcp/dry-run-mode/) for full details.

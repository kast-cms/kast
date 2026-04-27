---
title: MCP Server
description: Connect AI agents to Kast via the Model Context Protocol JSON-RPC endpoint.
---

Kast exposes a built-in [Model Context Protocol](https://modelcontextprotocol.io) server at `/mcp`. AI agents (Claude, etc.) use this to read and write CMS content under full RBAC and audit control.

## Transport

| Endpoint       | Method   | Description                                                         |
| -------------- | -------- | ------------------------------------------------------------------- |
| `GET /mcp/sse` | —        | Server-Sent Events transport — opens a session, returns `sessionId` |
| `POST /mcp`    | JSON-RPC | Handle tool calls on an existing session                            |

All requests require a valid Bearer token (agent token or user JWT).

## JSON-RPC methods

| Method       | Description                             |
| ------------ | --------------------------------------- |
| `initialize` | Handshake — returns server capabilities |
| `tools/list` | List all available tools                |
| `tools/call` | Execute a tool                          |

## Tool list

Kast exposes 15 built-in tools:

### Content Entry Tools

| Tool                    | Role   | Dry-runable | Description                             |
| ----------------------- | ------ | ----------- | --------------------------------------- |
| `list_content_entries`  | viewer | No          | List entries with filter and pagination |
| `get_content_entry`     | viewer | No          | Get a single entry with all locale data |
| `create_content_entry`  | editor | **Yes**     | Create a new entry (status = DRAFT)     |
| `update_content_entry`  | editor | **Yes**     | Update entry fields or status           |
| `publish_content_entry` | editor | No          | Publish or unpublish an entry           |
| `delete_content_entry`  | admin  | No          | Soft-delete (trash) an entry            |

### Content Type Tools

| Tool                  | Role   | Dry-runable | Description                        |
| --------------------- | ------ | ----------- | ---------------------------------- |
| `list_content_types`  | viewer | No          | List all content type definitions  |
| `get_content_type`    | viewer | No          | Get a content type with its fields |
| `create_content_type` | admin  | **Yes**     | Create a new content type          |
| `update_content_type` | admin  | **Yes**     | Update a content type              |

### Media, SEO & Audit Tools

| Tool             | Role   | Dry-runable | Description                               |
| ---------------- | ------ | ----------- | ----------------------------------------- |
| `list_media`     | viewer | No          | List media files                          |
| `get_media_file` | viewer | No          | Get metadata for a single media file      |
| `get_seo_score`  | viewer | No          | Get the SEO score and issues for an entry |
| `validate_seo`   | editor | No          | Trigger SEO validation job                |
| `get_audit_log`  | admin  | No          | Query the audit log with filters          |

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

---
title: Connecting Claude
description: Connect Claude Desktop or Claude Code to your Kast CMS via MCP.
sidebar:
  order: 1
---

Kast exposes a Model Context Protocol (MCP) server over SSE. Any MCP-compatible AI client — Claude Desktop, Claude Code, Cursor, Zed — can connect to it and call Kast tools directly.

## Prerequisites

- A running Kast API (local or hosted)
- An agent token with the scopes you need (see [Agent tokens](./agent-tokens))

## Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kast": {
      "url": "https://api.example.com/api/v1/mcp/sse",
      "headers": {
        "Authorization": "Bearer <your-agent-token>"
      }
    }
  }
}
```

Config file location:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Restart Claude Desktop. You should see "kast" appear in the MCP servers list.

## Claude Code (CLI)

```bash
claude mcp add kast \
  --transport sse \
  --url https://api.example.com/api/v1/mcp/sse \
  --header "Authorization: Bearer <your-agent-token>"
```

Verify:

```bash
claude mcp list
```

## Local development

When running the API locally:

```json
{
  "mcpServers": {
    "kast-local": {
      "url": "http://localhost:3001/api/v1/mcp/sse",
      "headers": {
        "Authorization": "Bearer <your-agent-token>"
      }
    }
  }
}
```

## Verifying the connection

Ask Claude:

> "List all content types in my Kast CMS"

Claude will call the `list_content_types` tool and return the result. If the connection is working, you'll see the response immediately.

## What Claude can do

Once connected, Claude can use all tools the agent token's scopes permit. See [Tools reference](./tools-reference) for the full list.

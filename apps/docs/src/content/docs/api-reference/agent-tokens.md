---
title: Agent Tokens API
description: Create scoped tokens for AI agents connecting via MCP.
---

Agent tokens are a special token type designed for AI agents. Unlike regular API tokens, they carry a **scope** — a list of the specific MCP tools the agent is allowed to call.

## List agent tokens

```http
GET /api/v1/agent-tokens
Authorization: Bearer <token>   (ADMIN+)
```

## Create agent token

```http
POST /api/v1/agent-tokens
Authorization: Bearer <token>   (ADMIN+)

{
  "name": "Claude content assistant",
  "scopes": [
    "list_content_types",
    "list_content_entries",
    "get_content_entry",
    "create_content_entry",
    "update_content_entry"
  ],
  "expiresAt": "2027-01-01T00:00:00Z"
}
```

`scopes` must be a subset of the 15 available MCP tool names. Omitting `scopes` grants access to all tools the agent's role permits.

The plain token is returned **once**. Store it securely.

## Revoke agent token

```http
DELETE /api/v1/agent-tokens/:id
Authorization: Bearer <token>
```

## Using the token

Configure your MCP client with:

```json
{
  "mcpServers": {
    "kast": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer <agent-token>"
      }
    }
  }
}
```

## Scope enforcement

When an agent calls a tool, Kast checks:

1. The agent token's `scopes` list includes the tool name.
2. The tool's `role` requirement ≤ the token's role level.

If either check fails, the call returns `403 Forbidden` and the attempt is logged to the audit log.

## Audit trail

Every tool call made with an agent token is recorded in the audit log with:

- `agentTokenId` — the token ID
- `agentName` — the token's `name` field
- `isDryRun` — whether dry-run mode was used
- The full input arguments (redacted for sensitive fields)

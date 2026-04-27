---
title: Agent Tokens
description: Create and manage agent tokens for MCP clients.
sidebar:
  order: 2
---

Agent tokens authenticate MCP clients (AI agents, automation scripts) to the Kast API. Unlike API keys, agent tokens are scoped to specific tools — an agent can only call the operations you explicitly allow.

## Create an agent token

### From the admin panel

1. Go to **Settings → Agent Tokens**.
2. Click **New agent token**.
3. Give it a name and select the scopes it needs.
4. Copy the token — it's shown only once.

### Via the SDK

```ts
const result = await kast.agentTokens.create({
  name: 'Claude content assistant',
  scopes: [
    'list_content_entries',
    'get_content_entry',
    'create_content_entry',
    'update_content_entry',
  ],
});

const { token } = (result as any).data;
// Store securely — shown only once
```

### Via the API

```http
POST /api/v1/agent-tokens
Authorization: Bearer <management-token>

{
  "name": "Claude content assistant",
  "scopes": ["list_content_entries", "get_content_entry", "create_content_entry"]
}
```

## Available scopes

Each scope corresponds to one MCP tool. Assign only what the agent needs.

| Scope                   | Minimum role | Tool                    |
| ----------------------- | ------------ | ----------------------- |
| `list_content_entries`  | viewer       | `list_content_entries`  |
| `get_content_entry`     | viewer       | `get_content_entry`     |
| `create_content_entry`  | editor       | `create_content_entry`  |
| `update_content_entry`  | editor       | `update_content_entry`  |
| `publish_content_entry` | editor       | `publish_content_entry` |
| `delete_content_entry`  | admin        | `delete_content_entry`  |
| `list_content_types`    | viewer       | `list_content_types`    |
| `get_content_type`      | viewer       | `get_content_type`      |
| `create_content_type`   | admin        | `create_content_type`   |
| `update_content_type`   | admin        | `update_content_type`   |
| `list_media`            | viewer       | `list_media`            |
| `get_media_file`        | viewer       | `get_media_file`        |
| `get_seo_score`         | viewer       | `get_seo_score`         |
| `validate_seo`          | editor       | `validate_seo`          |
| `get_audit_log`         | admin        | `get_audit_log`         |

## List and revoke tokens

```ts
// List
const { data: tokens } = await kast.agentTokens.list();

// Revoke
await kast.agentTokens.revoke(tokenId);
```

Revoking a token immediately invalidates it — any connected MCP client will receive 401 on the next tool call.

## Security recommendations

- Create one token per agent/use case — don't share tokens between different AI clients.
- Grant the minimum scopes needed.
- Rotate tokens regularly — revoke and recreate.
- Never commit agent tokens to source control.

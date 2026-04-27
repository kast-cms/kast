---
title: Agent Session Audit
description: Track and audit everything AI agents do in your CMS.
sidebar:
  order: 5
---

Every action an MCP agent takes — reading entries, creating content, triggering SEO validation — is recorded in the Kast audit log. You get full visibility into what AI agents are doing in your CMS.

## What gets logged

Every tool call that produces a side effect is logged with:

- The tool name (e.g. `create_content_entry`)
- The agent token name (e.g. `Claude content assistant`)
- The resource type and ID
- The action performed
- Timestamp

Read-only tools (`list_content_entries`, `get_content_entry`, etc.) are not logged to avoid noise.

## Viewing agent activity

### Admin panel

Go to **Audit Log** in the admin sidebar. Filter by **Actor type: agent** to see only agent-initiated actions.

### Via MCP tool

```
> Show me everything that happened in the CMS in the last 24 hours
```

Claude calls `get_audit_log` and returns a formatted summary.

### Via SDK

```ts
const { data: entries } = await kast.audit.list({
  from: new Date(Date.now() - 86_400_000).toISOString(),
  limit: 100,
});

const agentActions = entries.filter((e) => e.actorType === 'agent');
```

## Revoking a compromised token

If you suspect an agent token has been misused:

1. Go to **Settings → Agent Tokens**.
2. Find the token and click **Revoke**.
3. Review the audit log filtered to that token's name.
4. Create a new token with restricted scopes if needed.

Revocation is immediate — in-flight requests using the revoked token will receive 401 on their next call.

## Best practices

- Name agent tokens descriptively (`Claude content assistant`, `Zapier automation`) so audit entries are easy to trace.
- Review agent activity regularly — the audit log CSV export makes this easy.
- Scope tokens to the minimum required — a read-only agent should never have `delete_content_entry`.

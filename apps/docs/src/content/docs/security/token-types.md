---
title: Token Types
description: JWT tokens, API keys, and agent tokens in Kast CMS.
sidebar:
  order: 2
---

Kast uses four types of credentials, each with a different scope and lifetime.

## Access tokens (JWT)

Short-lived JWTs issued on login. Used in the `Authorization: Bearer` header for all management API calls.

- **Lifetime:** 15 minutes (configurable via `JWT_EXPIRES_IN`)
- **Storage:** In-memory only — never stored in the database
- **Use for:** Admin panel, management API calls from server-side code

```ts
const { accessToken } = await kast.auth.login(email, password);
kast.setAccessToken(accessToken);
```

## Refresh tokens

Long-lived tokens used to obtain new access tokens without re-authentication. Stored as SHA-256 hashes.

- **Lifetime:** 7 days
- **Rotation:** A new refresh token is issued on every refresh — old tokens are invalidated
- **Revocation:** Logout or password change invalidates all active refresh tokens

```ts
const { accessToken } = await kast.auth.refresh(refreshToken);
```

## API keys (management + delivery)

Static tokens created in Settings → API Tokens. Sent in the `X-Kast-Key` header.

| Type       | Access                                                             |
| ---------- | ------------------------------------------------------------------ |
| Management | Full write access — treat like a password                          |
| Delivery   | Read-only — returns only PUBLISHED entries. Safe for frontend use. |

- **Storage:** SHA-256 hash stored in the database (original shown only once)
- **Expiry:** Optional — set `expiresAt` when creating

```ts
// Create a delivery key
const result = await kast.tokens.create({
  name: 'Frontend delivery key',
  type: 'delivery',
  expiresAt: '2027-01-01T00:00:00Z',
});
```

## Agent tokens

MCP/automation tokens with explicit tool scopes. Used in the `Authorization: Bearer` header by AI agents and scripts.

- **Storage:** SHA-256 hash
- **Scopes:** Explicitly declared — an agent can only call tools it was granted
- **No expiry by default** — revoke manually when no longer needed

```ts
const result = await kast.agentTokens.create({
  name: 'Claude assistant',
  scopes: ['list_content_entries', 'get_content_entry'],
});
```

See [Agent tokens](../mcp/agent-tokens) for scope details.

## Summary

| Token type         | Auth method      | Read           | Write  | Expires  |
| ------------------ | ---------------- | -------------- | ------ | -------- |
| Access token       | `Bearer <JWT>`   | yes            | yes    | 15 min   |
| Refresh token      | POST body        | —              | —      | 7 days   |
| Management API key | `X-Kast-Key`     | yes            | yes    | optional |
| Delivery API key   | `X-Kast-Key`     | published only | no     | optional |
| Agent token        | `Bearer <token>` | scoped         | scoped | no       |

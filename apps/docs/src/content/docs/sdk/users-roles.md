---
title: Users & Roles
description: Manage users, roles, and API tokens with the SDK.
sidebar:
  order: 7
---

## List users

```ts
const { data: users } = await kast.users.list({ limit: 20 });
```

## Get user

```ts
const { data: user } = await kast.users.get(userId);
```

## Invite user

```ts
await kast.users.invite({ email: 'editor@example.com', role: 'editor' });
```

## Update user

```ts
await kast.users.update(userId, { name: 'New Name', role: 'admin' });
```

## Deactivate / reactivate

```ts
await kast.users.update(userId, { isActive: false });
await kast.users.update(userId, { isActive: true });
```

## Delete user

```ts
await kast.users.delete(userId);
```

---

## Roles

```ts
const { data: roles } = await kast.roles.list();
// [{ name: 'super_admin' }, { name: 'admin' }, { name: 'editor' }, { name: 'viewer' }]
```

---

## API Tokens

### List tokens

```ts
const { data: tokens } = await kast.tokens.list();
```

### Create token

```ts
const result = await kast.tokens.create({
  name: 'Frontend delivery key',
  type: 'delivery',
  expiresAt: '2027-01-01T00:00:00Z',
});
const { token } = (result as any).data;
// Store token — it's shown only once
```

### Revoke token

```ts
await kast.tokens.revoke(tokenId);
```

---

## Agent Tokens

```ts
// Create
const result = await kast.agentTokens.create({
  name: 'Claude assistant',
  scopes: ['list_content_entries', 'get_content_entry', 'create_content_entry'],
});

// List
const { data: agentTokens } = await kast.agentTokens.list();

// Revoke
await kast.agentTokens.revoke(tokenId);
```

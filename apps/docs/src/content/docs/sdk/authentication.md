---
title: Authentication
description: Login, OAuth, password reset, and token management via the SDK.
sidebar:
  order: 2
---

## Login with password

```ts
const result = await kast.auth.login('admin@example.com', 'password');
const { accessToken, refreshToken } = (result as any).data;

// Store the access token for subsequent calls
kast.setAccessToken(accessToken);
```

## Refresh token

```ts
const result = await kast.auth.refresh(refreshToken);
kast.setAccessToken((result as any).data.accessToken);
```

## Get current user

```ts
const { data: user } = (await kast.auth.me()) as any;
// { id, name, email, role, createdAt }
```

## Update profile

```ts
await kast.auth.updateProfile({ name: 'New Name' });
```

## OAuth

The OAuth flow requires a browser redirect — the SDK returns the URL to navigate to:

```ts
// Redirect the user to Google OAuth
const googleUrl = kast.auth.getOAuthUrl('google');
window.location.href = googleUrl;

// Redirect the user to GitHub OAuth
const githubUrl = kast.auth.getOAuthUrl('github');
window.location.href = githubUrl;
```

After the OAuth flow completes, Kast redirects to `/oauth-callback?accessToken=...&refreshToken=...`. Parse the tokens from the URL and call `kast.setAccessToken(accessToken)`.

## Password reset

```ts
// Step 1 — request reset email
await kast.auth.forgotPassword('user@example.com');
// Always resolves, never reveals whether the email exists

// Step 2 — submit new password (token from the email link)
await kast.auth.resetPassword(token, 'new-secure-password');
```

## Logout

```ts
await kast.auth.logout(refreshToken);
// The refresh token is revoked server-side
```

## Error handling

All SDK methods throw a `KastApiError` on non-2xx responses:

```ts
import { KastClient } from '@kast/sdk';

try {
  await kast.auth.login('wrong@example.com', 'bad-password');
} catch (err) {
  if (err instanceof Error) {
    console.error(err.message); // "Invalid credentials"
  }
}
```

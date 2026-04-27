---
title: Installation
description: Install and configure @kast/sdk in your project.
sidebar:
  order: 1
---

## Install

```bash
npm install @kast/sdk
# or
pnpm add @kast/sdk
# or
yarn add @kast/sdk
```

`@kast/sdk` ships as dual ESM/CJS with full TypeScript types. No additional type packages needed.

## Initialize

```ts
import { KastClient } from '@kast/sdk';

const kast = new KastClient({
  baseUrl: 'http://localhost:3000', // your Kast API URL
  apiKey: 'kast_live_...', // delivery key (read-only, public)
});
```

### Options

| Option        | Type           | Description                                                  |
| ------------- | -------------- | ------------------------------------------------------------ |
| `baseUrl`     | `string`       | Required. Kast API base URL (no trailing slash).             |
| `apiKey`      | `string`       | Delivery API key — sent as `X-Kast-Key`.                     |
| `accessToken` | `string`       | JWT access token — sent as `Authorization: Bearer`.          |
| `fetch`       | `typeof fetch` | Custom fetch implementation (useful for Node < 18 or tests). |

Use `apiKey` for public read-only frontend apps. Use `accessToken` for admin/server-side operations.

### Environment variables (Next.js)

```bash
# .env.local
NEXT_PUBLIC_KAST_API_URL=http://localhost:3000
KAST_DELIVERY_API_KEY=kast_live_...
KAST_ADMIN_TOKEN=eyJ...  # for server-side admin operations
```

```ts
// lib/kast.ts
import { KastClient } from '@kast/sdk';

export const kast = new KastClient({
  baseUrl: process.env.NEXT_PUBLIC_KAST_API_URL!,
  apiKey: process.env.KAST_DELIVERY_API_KEY,
});
```

## Set access token at runtime

After a user logs in, update the token:

```ts
const result = await kast.auth.login('user@example.com', 'password');
kast.setAccessToken((result as any).data.accessToken);
```

## Resources

The client exposes all API resources as lazily-initialised getters:

```ts
kast.auth; // Authentication
kast.contentTypes; // Content type schemas
kast.content; // Content entries
kast.media; // Media files
kast.seo; // SEO metadata
kast.users; // Users
kast.roles; // Roles
kast.tokens; // API tokens
kast.agentTokens; // MCP agent tokens
kast.webhooks; // Webhooks
kast.forms; // Forms
kast.menus; // Navigation menus
kast.locales; // Locales
kast.versions; // Entry version history
kast.trash; // Trash
kast.settings; // Global settings
kast.audit; // Audit log
kast.dashboard; // Dashboard stats
kast.plugins; // Plugin config
kast.health; // Health check
```

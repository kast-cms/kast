<div align="center">

# @kast-cms/sdk

**Official TypeScript SDK for the [Kast CMS](https://github.com/kast-cms/kast) API**

[![npm version](https://img.shields.io/npm/v/@kast-cms/sdk?color=blueviolet&style=flat-square)](https://www.npmjs.com/package/@kast-cms/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@kast-cms/sdk?style=flat-square)](https://www.npmjs.com/package/@kast-cms/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://github.com/kast-cms/kast/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=flat-square&logo=node.js)](https://nodejs.org/)

> A fully-typed, zero-dependency TypeScript client for every Kast CMS resource — content, media, SEO, forms, users, webhooks, and more.

</div>

---

## Installation

```bash
# npm
npm install @kast-cms/sdk

# pnpm
pnpm add @kast-cms/sdk

# yarn
yarn add @kast-cms/sdk
```

---

## Quick Start

```ts
import { KastClient } from '@kast-cms/sdk';

const kast = new KastClient({
  baseUrl: 'https://your-kast-api.com',
  apiKey: process.env.KAST_API_KEY,
});

// Fetch all entries for a content type
const { data, meta } = await kast.entries('blog-post').list();
console.log(`Found ${meta.total} posts`);

// Get a single entry
const { data: post } = await kast.entries('blog-post').findOne('entry-id');

// Create an entry
const { data: newPost } = await kast.entries('blog-post').create({
  fields: { title: 'Hello World', body: 'My first post' },
  status: 'PUBLISHED',
});
```

---

## Authentication

The SDK supports two authentication methods:

### API Key (recommended for server-side)

```ts
const kast = new KastClient({
  baseUrl: 'https://your-kast-api.com',
  apiKey: 'kast_live_xxxxxxxxxxxxxxxx',
});
```

### Bearer Token (for user sessions)

```ts
const kast = new KastClient({
  baseUrl: 'https://your-kast-api.com',
  accessToken: userAccessToken,
});

// Or set it dynamically after login:
kast.setAccessToken(token);
```

---

## Resources

The client exposes a resource for every Kast API domain:

| Resource             | Description                                      |
| -------------------- | ------------------------------------------------ |
| `kast.entries(type)` | CRUD for content entries, versioning, scheduling |
| `kast.contentTypes`  | Manage content type schemas                      |
| `kast.media`         | Upload and manage media files                    |
| `kast.seo`           | Per-entry SEO metadata                           |
| `kast.forms`         | Form definitions and submissions                 |
| `kast.menus`         | Navigation menu management                       |
| `kast.locales`       | Internationalisation and locale config           |
| `kast.users`         | User management                                  |
| `kast.roles`         | Role and permission management                   |
| `kast.webhooks`      | Webhook registration and management              |
| `kast.plugins`       | Plugin registry                                  |
| `kast.tokens`        | API token management                             |
| `kast.agentTokens`   | MCP / AI agent token management                  |
| `kast.audit`         | Audit log queries                                |
| `kast.dashboard`     | Dashboard stats and activity                     |
| `kast.settings`      | Global CMS settings                              |
| `kast.trash`         | Soft-deleted content recovery                    |
| `kast.versions`      | Content version history                          |
| `kast.auth`          | Authentication flows                             |
| `kast.health`        | API health check                                 |

---

## Examples

### Fetch entries with pagination

```ts
const page = await kast.entries('product').list({
  limit: 20,
  cursor: undefined,
  locale: 'en',
  status: 'PUBLISHED',
});

// Next page
if (page.meta.hasNextPage) {
  const next = await kast.entries('product').list({
    limit: 20,
    cursor: page.meta.cursor,
  });
}
```

### Upload media

```ts
const formData = new FormData();
formData.append('file', file);

const { data: media } = await kast.media.upload(formData);
console.log(media.url);
```

### Manage locales

```ts
// List all locales
const { data: locales } = await kast.locales.list();

// Create a new locale
await kast.locales.create({ code: 'ar', name: 'Arabic', direction: 'RTL' });
```

### Query audit logs

```ts
const logs = await kast.audit.list({
  action: 'ENTRY_PUBLISHED',
  limit: 50,
});
```

### Register a webhook

```ts
await kast.webhooks.create({
  name: 'Revalidate blog',
  url: 'https://my-site.com/api/revalidate',
  events: ['ENTRY_PUBLISHED', 'ENTRY_UNPUBLISHED'],
  secret: process.env.WEBHOOK_SECRET,
});
```

---

## Custom Fetch (Edge / Next.js)

You can pass a custom `fetch` implementation — useful for Next.js caching:

```ts
import { KastClient } from '@kast-cms/sdk';

const kast = new KastClient({
  baseUrl: process.env.KAST_API_URL!,
  apiKey: process.env.KAST_API_KEY!,
  // Next.js extended fetch with ISR revalidation
  fetch: (url, init) => fetch(url, { ...init, next: { revalidate: 60 } }),
});
```

---

## TypeScript

Every resource method is fully typed. Import types directly:

```ts
import type {
  ContentEntrySummary,
  ContentEntryDetail,
  ApiListResponse,
  KastClientOptions,
} from '@kast-cms/sdk';
```

---

## Links

- [GitHub Repository](https://github.com/kast-cms/kast)
- [npm Package](https://www.npmjs.com/package/@kast-cms/sdk)
- [Documentation](https://kastcms.com/docs)
- [Plugin SDK (`@kast-cms/plugin-sdk`)](https://www.npmjs.com/package/@kast-cms/plugin-sdk)
- [Scaffolding CLI (`create-kast-app`)](https://www.npmjs.com/package/create-kast-app)

---

## About Kast

Kast is an open-source, AI-native, developer-first headless CMS built on NestJS + Next.js. It ships with a built-in MCP server for AI agent control, first-class SEO tooling, and RTL/i18n support from day one.

---

## Author

Built and maintained by **Oday Bakkour** — [oday-bakkour.com](https://oday-bakkour.com)

---

## License

[MIT](https://github.com/kast-cms/kast/blob/main/LICENSE) © 2026 Oday Bakkour

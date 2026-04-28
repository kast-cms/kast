---
title: First-Party Plugins
description: Configuration guide for the plugins that ship with Kast.
sidebar:
  order: 8
---

Kast ships six plugins in the `plugins/` directory of the monorepo. Each has a `README.md` with full details.

## @kast-cms/kast-plugin-meilisearch

Syncs published content entries to Meilisearch for full-text search.

**Hooks:** `content.published`, `content.updated`, `content.trashed`

| Env var                    | Required | Notes                                   |
| -------------------------- | -------- | --------------------------------------- |
| `MEILISEARCH_HOST`         | yes      | e.g. `https://search.example.com`       |
| `MEILISEARCH_MASTER_KEY`   | yes      | Master key for the Meilisearch instance |
| `MEILISEARCH_INDEX_PREFIX` | no       | Default: `kast_`                        |

Each content type becomes a separate index: `kast_blog-post`, `kast_product`, etc.

---

## @kast-cms/kast-plugin-r2

Stores uploaded media in Cloudflare R2 instead of local disk.

| Env var                | Required             |
| ---------------------- | -------------------- |
| `R2_ACCOUNT_ID`        | yes                  |
| `R2_ACCESS_KEY_ID`     | yes                  |
| `R2_SECRET_ACCESS_KEY` | yes                  |
| `R2_BUCKET_NAME`       | yes                  |
| `R2_PUBLIC_URL`        | yes — CDN URL prefix |

---

## @kast-cms/kast-plugin-resend

Sends transactional emails (form notifications, invite emails) via [Resend](https://resend.com).

| Env var             | Required                      |
| ------------------- | ----------------------------- |
| `RESEND_API_KEY`    | yes                           |
| `RESEND_FROM_EMAIL` | yes — verified sender address |

---

## @kast-cms/kast-plugin-sentry

Captures unhandled errors from the Kast API and forwards them to Sentry.

| Env var              | Required                   |
| -------------------- | -------------------------- |
| `SENTRY_DSN`         | yes                        |
| `SENTRY_ENVIRONMENT` | no — default: `production` |

---

## @kast-cms/kast-plugin-stripe

Listens to Stripe webhooks and syncs product/price data as content entries.

| Env var                    | Required                |
| -------------------------- | ----------------------- |
| `STRIPE_SECRET_KEY`        | yes                     |
| `STRIPE_WEBHOOK_SECRET`    | yes                     |
| `STRIPE_PRODUCT_TYPE_SLUG` | no — default: `product` |

---

## @kast-cms/kast-plugin-example

A minimal reference plugin with a single `content.created` hook. Use it as a starting point when building your own plugin.

No env vars required.

```ts
// plugins/kast-plugin-example/src/index.ts
import { IKastPlugin, KastPluginContext, PluginHook } from '@kast-cms/plugin-sdk';

export class ExamplePlugin implements IKastPlugin {
  async onLoad(ctx: KastPluginContext): Promise<void> {
    ctx.on(PluginHook.CONTENT_CREATED, (payload) => {
      process.stderr.write(`[kast-plugin-example] content.created: ${JSON.stringify(payload)}\n`);
    });
  }
}

export default ExamplePlugin;
```

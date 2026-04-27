---
title: What Is a Plugin?
description: Understand the Kast plugin system and what plugins can do.
sidebar:
  order: 1
---

Kast plugins extend the CMS without modifying core code. A plugin is a Node.js package that:

- **Listens to lifecycle hooks** — react when content is published, media is uploaded, etc.
- **Contributes admin UI pages** — add your own pages to the admin sidebar.
- **Reads and writes config** — store plugin-specific settings in the database, editable from the admin panel.
- **Declares required env vars** — the admin panel surfaces missing vars as warnings.

## How plugins are loaded

At startup the Kast API scans the `plugins/` directory in the monorepo root. Any subdirectory that contains a valid `kast-plugin.json` manifest and a compiled `dist/index.js` is loaded automatically.

The loader:

1. Reads and validates `kast-plugin.json` against the manifest schema.
2. Dynamic-imports `dist/index.js` and looks for a default export implementing `IKastPlugin`.
3. Calls `plugin.onLoad(ctx)` with a sandboxed context object.
4. Registers any admin pages declared in `adminPages`.

## What a plugin cannot do

- Access the database directly — only via the public API or the context helpers.
- Override core API routes.
- Run code outside of `onLoad` and its registered hook handlers.

## First-party plugins

Kast ships with six ready-to-use plugins:

| Plugin                    | Purpose                             |
| ------------------------- | ----------------------------------- |
| `kast-plugin-meilisearch` | Full-text search sync               |
| `kast-plugin-r2`          | Cloudflare R2 media storage         |
| `kast-plugin-resend`      | Transactional email via Resend      |
| `kast-plugin-sentry`      | Error monitoring via Sentry         |
| `kast-plugin-stripe`      | Stripe product/price sync           |
| `kast-plugin-example`     | Minimal example for getting started |

See [First-party plugins](./first-party-plugins) for configuration details.

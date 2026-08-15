---
title: What Is a Plugin?
description: Understand the Kast plugin system, its trust model, and what plugins can do.
sidebar:
  order: 1
---

Kast plugins extend the CMS without modifying core code. A plugin is a Node.js package that:

- **Listens to lifecycle hooks** — react when content is published, media is uploaded, etc.
- **Registers extensions** — supply a storage adapter, an email transport, or an error reporter.
- **Reads and writes config** — store plugin-specific settings in the database, editable from the admin panel.
- **Declares required env vars** — the admin panel surfaces missing vars as warnings.

## Trust model — read this first

**Plugins are trusted code. They run in the API process with full Node.js
capability.** A plugin can read `process.env` (every secret your deployment
holds), the filesystem, and the network, regardless of what its manifest declares.

The `permissions` array in `kast-plugin.json` is a **compatibility declaration,
not a sandbox.** The loader validates that every permission is one it recognises
and refuses to load a plugin asking for something unsupported. It does not, and
cannot, restrict what the plugin's code then does.

The practical rule: **install a plugin only if you would be willing to merge its
source into your own codebase.** There is no isolation boundary between plugin
code and your API, your database credentials, or your secret encryption key.

Kast does bound the blast radius of _failure_, if not of intent:

- A plugin whose module fails to load is skipped; the rest of the API starts.
- A plugin whose manifest is invalid or asks for an unsupported permission is
  skipped rather than crashing the process.
- A hook handler that throws or rejects is caught and logged; it cannot take down
  the request that emitted the event.

## How plugins get onto a deployment

Plugins are **bundled at build time**. There is no registry, no download, and no
artifact verification — a plugin becomes available to an instance by being present
in that instance's `plugins/` directory when the image is built.

The lifecycle has three distinct states, and the admin panel shows all three:

| State          | What it means                                               | How it changes                                          |
| -------------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| **Bundled**    | The directory exists under `plugins/` with a valid manifest | Add the directory and rebuild the image                 |
| **Registered** | A database record exists, so the plugin can be enabled      | `POST /api/v1/plugins/register`, or the admin panel     |
| **Enabled**    | The module is loaded and its hook handlers are live         | `POST /api/v1/plugins/:name/enable`, or the admin panel |

To add a plugin:

1. Place it in `plugins/<your-plugin>/` with a `kast-plugin.json` and a build that
   emits `dist/index.js`.
2. Rebuild and redeploy the API image. (The production image copies `plugins/`,
   and a plugin's own dependencies must resolve inside that image.)
3. Register it, then enable it.

`POST /api/v1/plugins/register` accepts only a name the API can already discover
on disk. It will not fetch anything, and it fails if the plugin is not bundled.

Deregistering (`DELETE /api/v1/plugins/:name`) unloads the plugin and clears its
record. **The code stays on disk** and will be discoverable again — deregistering
is not uninstalling in the npm sense.

## How plugins are loaded

At startup the Kast API scans the `plugins/` directory. Any subdirectory
containing a valid `kast-plugin.json` and a compiled `dist/index.js` is a
candidate.

The loader:

1. Reads and validates `kast-plugin.json` against the manifest schema.
2. Checks the declared permissions against the set it supports.
3. Skips the plugin entirely if its database record has `isActive: false`.
4. Dynamic-imports `dist/index.js` and looks for a default export implementing
   `IKastPlugin`.
5. Calls `plugin.onLoad(ctx)` with the plugin context.
6. Registers any extensions the plugin supplies through that context.

Because loading happens at startup, **enabling or disabling a plugin takes effect
on the next restart of each API process.** Toggling the switch updates the record
and unloads the instance that served the request; other replicas keep the old
state until they restart. See
[Running more than one API replica](https://github.com/kast-cms/kast/blob/main/docs/ops/MULTI_INSTANCE.md).

## What the plugin context provides

`onLoad(ctx)` receives:

- `ctx.on(hook, handler)` — subscribe to a lifecycle hook.
- `ctx.getConfig()` / `ctx.setConfig()` — read and write this plugin's stored
  configuration. Secret-looking keys are encrypted at rest.
- `ctx.pluginName` — this plugin's name.
- Extension registration for storage adapters, email transports, and error
  reporters.

There is no direct database handle and no route registration. Reach content
through the public API.

## Admin pages

`adminPages` in the manifest adds an entry to the plugin's card in the admin
panel, linking to a **built-in, generic configuration screen** for that plugin —
one that shows its record, status, and stored configuration.

It does **not** mount UI shipped by the plugin. A plugin cannot currently supply
its own React components to the admin; module federation for plugin-supplied UI
is not implemented. Declare `adminPages` to give your plugin a labelled entry
point, not to ship an interface.

## First-party plugins

Kast ships with six ready-to-use plugins:

| Plugin                              | Purpose                             |
| ----------------------------------- | ----------------------------------- |
| `@kast-cms/kast-plugin-meilisearch` | Full-text search sync               |
| `@kast-cms/kast-plugin-r2`          | Cloudflare R2 media storage         |
| `@kast-cms/kast-plugin-resend`      | Transactional email via Resend      |
| `@kast-cms/kast-plugin-sentry`      | Error monitoring via Sentry         |
| `@kast-cms/kast-plugin-stripe`      | Stripe product/price sync           |
| `@kast-cms/kast-plugin-example`     | Minimal example for getting started |

See [First-party plugins](./first-party-plugins) for configuration details.

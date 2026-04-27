---
title: Publishing to npm
description: Share your Kast plugin with the community on npm.
sidebar:
  order: 7
---

Any npm package that follows the Kast plugin conventions can be installed and used as a Kast plugin.

## Package requirements

1. `kast-plugin.json` at the package root (published as part of the npm package).
2. A compiled `dist/index.js` with a default export implementing `IKastPlugin`.
3. `@kast/plugin-sdk` as a peer dependency.

## package.json for an npm plugin

```json
{
  "name": "kast-plugin-slack-notify",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist", "kast-plugin.json", "README.md"],
  "peerDependencies": {
    "@kast/plugin-sdk": "^0.3.0"
  }
}
```

## Build before publish

```bash
tsc  # or tsup / unbuild
npm publish --access public
```

## Installing a community plugin

In your Kast monorepo:

```bash
# Install into the plugins workspace
pnpm add kast-plugin-slack-notify --filter kast-plugin-slack-notify

# Or install globally in the API
pnpm add kast-plugin-slack-notify --filter api
```

Then symlink or copy the package into the `plugins/` directory so the loader can find it, and add it to `turbo.json` if you want it to participate in builds.

:::tip
Convention: name your plugin `kast-plugin-<feature>` so it's discoverable via `npm search kast-plugin`.
:::

## README checklist

A good plugin README includes:

- What it does
- `kast-plugin.json` example
- Required env vars
- How to configure it in the admin panel
- Any known limitations

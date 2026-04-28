<div align="center">

# @kast-cms/plugin-sdk

**Types and utilities for building [Kast CMS](https://github.com/kast-cms/kast) plugins**

[![npm version](https://img.shields.io/npm/v/@kast-cms/plugin-sdk?color=blueviolet&style=flat-square)](https://www.npmjs.com/package/@kast-cms/plugin-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://github.com/kast-cms/kast/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

> Everything you need to build a type-safe Kast CMS plugin — the `IKastPlugin` interface, lifecycle hooks, permission enums, and the `kast-plugin.json` manifest schema.

</div>

---

## Installation

```bash
npm install @kast-cms/plugin-sdk
# or
pnpm add @kast-cms/plugin-sdk
```

---

## Usage

### 1. Create a plugin class

```ts
import type { IKastPlugin, KastPluginContext } from '@kast-cms/plugin-sdk';
import { PluginHook } from '@kast-cms/plugin-sdk';

export class MyPlugin implements IKastPlugin {
  async onLoad(ctx: KastPluginContext): Promise<void> {
    // Read config persisted in the Kast admin
    const config = await ctx.getConfig();

    // Subscribe to lifecycle hooks
    ctx.on(PluginHook.CONTENT_PUBLISHED, async (payload) => {
      console.log('Content published:', payload);
    });
  }
}
```

### 2. Create `kast-plugin.json`

Every plugin must include a manifest at its package root:

```json
{
  "name": "kast-plugin-my-plugin",
  "version": "1.0.0",
  "displayName": "My Plugin",
  "description": "Does something useful",
  "permissions": ["content:read"],
  "hooks": ["content.published"],
  "adminPages": [],
  "env": ["MY_PLUGIN_API_KEY"]
}
```

---

## API Reference

### `IKastPlugin`

Interface every plugin must implement.

```ts
interface IKastPlugin {
  onLoad(ctx: KastPluginContext): Promise<void>;
}
```

### `KastPluginContext`

Passed to `onLoad` at application startup.

| Method / Property    | Description                         |
| -------------------- | ----------------------------------- |
| `on(event, handler)` | Subscribe to a lifecycle hook       |
| `getConfig()`        | Read persisted plugin config        |
| `setConfig(data)`    | Write persisted plugin config       |
| `pluginName`         | The plugin's name from its manifest |

### `PluginHook`

| Value                 | Fires when…                      |
| --------------------- | -------------------------------- |
| `content.created`     | A content item is created        |
| `content.updated`     | A content item is updated        |
| `content.deleted`     | A content item is deleted        |
| `content.published`   | A content item is published      |
| `content.trashed`     | A content item is moved to trash |
| `content.unpublished` | A content item is unpublished    |
| `media.uploaded`      | A media file is uploaded         |
| `media.deleted`       | A media file is deleted          |

### `PluginPermission`

| Value            | Grants access to…                |
| ---------------- | -------------------------------- |
| `content:read`   | Read content items               |
| `content:write`  | Create / update / delete content |
| `settings:read`  | Read site settings               |
| `settings:write` | Modify site settings             |
| `media:read`     | Read media library               |
| `media:write`    | Upload / delete media            |

### `pluginManifestSchema`

Zod schema for validating `kast-plugin.json`. Use it in your own tooling:

```ts
import { pluginManifestSchema } from '@kast-cms/plugin-sdk';

const manifest = pluginManifestSchema.parse(JSON.parse(raw));
```

---

## Documentation

Full plugin development guide at **[docs.kast.dev](https://docs.kast.dev)**

---

## License

MIT © [Kast CMS](https://github.com/kast-cms/kast)

---
title: Hooks Reference
description: All lifecycle hooks available to Kast plugins.
sidebar:
  order: 3
---

Hooks are emitted by the Kast API on the internal event bus. Subscribe in `onLoad` via `ctx.on(hook, handler)`.

## Content hooks

| Hook                  | Enum                             | When                                    |
| --------------------- | -------------------------------- | --------------------------------------- |
| `content.created`     | `PluginHook.CONTENT_CREATED`     | A new entry is saved for the first time |
| `content.updated`     | `PluginHook.CONTENT_UPDATED`     | An existing entry is updated            |
| `content.published`   | `PluginHook.CONTENT_PUBLISHED`   | An entry transitions to PUBLISHED       |
| `content.unpublished` | `PluginHook.CONTENT_UNPUBLISHED` | An entry transitions from PUBLISHED     |
| `content.trashed`     | `PluginHook.CONTENT_TRASHED`     | An entry is moved to trash              |
| `content.deleted`     | `PluginHook.CONTENT_DELETED`     | An entry is permanently deleted         |

### Content hook payload

```ts
interface ContentHookPayload {
  entryId: string;
  typeSlug: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'SCHEDULED';
}
```

## Media hooks

| Hook             | Enum                        | When                            |
| ---------------- | --------------------------- | ------------------------------- |
| `media.uploaded` | `PluginHook.MEDIA_UPLOADED` | A file is uploaded successfully |
| `media.deleted`  | `PluginHook.MEDIA_DELETED`  | A media file is moved to trash  |

### Media hook payload

```ts
interface MediaHookPayload {
  fileId: string;
  filename: string;
  mimeType: string;
  url: string;
}
```

---

## Subscribe to a hook

```ts
import { IKastPlugin, KastPluginContext, PluginHook } from '@kast/plugin-sdk';

export class MyPlugin implements IKastPlugin {
  async onLoad(ctx: KastPluginContext): Promise<void> {
    ctx.on(PluginHook.CONTENT_PUBLISHED, async (payload) => {
      const p = payload as { entryId: string; typeSlug: string };
      console.log(`Published: ${p.typeSlug}/${p.entryId}`);
    });
  }
}

export default MyPlugin;
```

Handlers can be async — the event bus awaits them before moving on.

## Declare hooks in the manifest

Any hook you subscribe to must also appear in `kast-plugin.json`:

```json
{
  "hooks": ["content.published", "content.trashed"]
}
```

Hooks not declared in the manifest are silently ignored at load time.

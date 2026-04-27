---
title: Plugin Config
description: Read and write plugin configuration from within a plugin.
sidebar:
  order: 6
---

Plugins can persist configuration in the Kast database without needing their own tables. The `KastPluginContext` provides `getConfig` and `setConfig` for this.

## Read config in `onLoad`

```ts
async onLoad(ctx: KastPluginContext): Promise<void> {
  const config = await ctx.getConfig();
  // { webhookUrl: 'https://...', channel: '#general' }

  const webhookUrl = (config['webhookUrl'] as string) ?? process.env['SLACK_WEBHOOK_URL'];
  // fall back to env var if config not yet set
}
```

## Write config from a hook

```ts
ctx.on(PluginHook.CONTENT_PUBLISHED, async () => {
  const config = await ctx.getConfig();
  await ctx.setConfig({ ...config, lastPublishedAt: new Date().toISOString() });
});
```

## Update config via the SDK

Admins can also update plugin config from outside the plugin, using the management API:

```ts
// Read
const { data: config } = await kast.plugins.getConfig('kast-plugin-slack-notify');

// Update
await kast.plugins.updateConfig('kast-plugin-slack-notify', {
  webhookUrl: 'https://hooks.slack.com/new-url',
  channel: '#deployments',
});
```

## Config editor in the admin panel

When a plugin has an admin page, the built-in config panel at `/plugins/<name>` shows a JSON editor backed by `GET/PATCH /api/v1/plugins/:name/config`. No extra code needed.

## Best practices

- Keep config small — it's stored as a single JSON blob.
- Prefer env vars for secrets (they never leave the server). Store only non-sensitive settings in plugin config.
- Call `getConfig()` inside `onLoad`, not on every hook invocation, to avoid unnecessary DB reads.

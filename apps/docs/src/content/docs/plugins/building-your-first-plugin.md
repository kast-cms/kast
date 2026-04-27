---
title: Building Your First Plugin
description: Step-by-step guide to creating a Kast plugin from scratch.
sidebar:
  order: 4
---

This guide builds a simple plugin that logs a Slack notification whenever content is published.

## 1. Scaffold the package

```bash
mkdir plugins/kast-plugin-slack-notify
cd plugins/kast-plugin-slack-notify
```

Create `package.json`:

```json
{
  "name": "kast-plugin-slack-notify",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "@kast/plugin-sdk": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

Create `tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

## 2. Write the manifest

Create `kast-plugin.json`:

```json
{
  "name": "kast-plugin-slack-notify",
  "version": "1.0.0",
  "displayName": "Slack Notify",
  "description": "Posts a Slack message when content is published.",
  "permissions": ["content:read"],
  "hooks": ["content.published"],
  "adminPages": [],
  "env": ["SLACK_WEBHOOK_URL"]
}
```

## 3. Implement the plugin

Create `src/index.ts`:

```ts
import { IKastPlugin, KastPluginContext, PluginHook } from '@kast/plugin-sdk';

export class SlackNotifyPlugin implements IKastPlugin {
  async onLoad(ctx: KastPluginContext): Promise<void> {
    const webhookUrl = process.env['SLACK_WEBHOOK_URL'];

    if (!webhookUrl) {
      console.warn('[kast-plugin-slack-notify] SLACK_WEBHOOK_URL not set — plugin disabled');
      return;
    }

    ctx.on(PluginHook.CONTENT_PUBLISHED, async (payload) => {
      const p = payload as { entryId: string; typeSlug: string };

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `✅ Published: *${p.typeSlug}* entry \`${p.entryId}\``,
        }),
      });
    });

    console.log('[kast-plugin-slack-notify] Loaded');
  }
}

export default SlackNotifyPlugin;
```

## 4. Build and run

```bash
# From monorepo root
pnpm install
pnpm build --filter kast-plugin-slack-notify

# Set your env var
echo "SLACK_WEBHOOK_URL=https://hooks.slack.com/..." >> apps/api/.env

# Start the API — plugin loads automatically
pnpm dev --filter api
```

You should see `[kast-plugin-slack-notify] Loaded` in the API logs on startup.

## 5. Test it

Publish any content entry in the admin panel. Check your Slack channel — you should see the notification.

---

## Next steps

- [Plugin config](./plugin-config) — let admins configure the webhook URL from the UI instead of an env var.
- [Admin UI panels](./admin-ui-panels) — add a status page to the admin sidebar.
- [Publishing to npm](./publishing-to-npm) — share your plugin with the community.

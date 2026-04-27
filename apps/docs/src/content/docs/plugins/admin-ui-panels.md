---
title: Admin UI Panels
description: Add custom pages to the Kast admin panel from a plugin.
sidebar:
  order: 5
---

Plugins can contribute pages to the Kast admin sidebar by declaring `adminPages` in their manifest.

## Declare a page

```json
// kast-plugin.json
{
  "adminPages": [
    {
      "label": "Slack Notify",
      "path": "/plugins/slack-notify",
      "icon": "Bell"
    }
  ]
}
```

| Field   | Notes                                                          |
| ------- | -------------------------------------------------------------- |
| `label` | Text shown in the admin sidebar                                |
| `path`  | Route within the admin app — must start with `/plugins/`       |
| `icon`  | Any [Lucide](https://lucide.dev/icons/) icon name (PascalCase) |

## How it works

The Kast admin panel reads active plugins from `GET /api/v1/plugins` and dynamically renders a sidebar entry for each `adminPages` item. Clicking the entry navigates to the declared `path`.

The page itself is served by the Kast admin Next.js app at `apps/admin/app/plugins/[plugin]/page.tsx`. The admin provides a catch-all route that plugin pages can hook into via the plugin name segment.

:::note
Full Module Federation support for plugin-owned React components is planned for a future release. Currently, admin pages display plugin config and status using the built-in config editor UI.
:::

## Config panel (built-in)

Without custom UI, visiting `/plugins/slack-notify` shows the plugin's name, description, enable/disable toggle, and a JSON config editor for any stored config.

This is enough for most use cases — let admins update webhook URLs or API keys directly.

## Enabling/disabling from the admin

Plugins can be toggled from the admin panel:

- Navigate to **Settings → Plugins**.
- Find your plugin and click the toggle.
- The API calls `POST /api/v1/plugins/:name/enable` or `disable`.

When disabled, the plugin's `onLoad` is not called on the next restart.

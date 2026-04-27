---
title: Plugin Manifest
description: kast-plugin.json reference for Kast plugins.
sidebar:
  order: 2
---

Every plugin must have a `kast-plugin.json` file in its root directory. Kast validates this against a Zod schema at startup — invalid manifests prevent the plugin from loading.

## Minimal example

```json
{
  "name": "kast-plugin-example",
  "version": "1.0.0",
  "displayName": "Example Plugin",
  "description": "Demonstrates the Kast plugin system with content hooks.",
  "permissions": ["content:read"],
  "hooks": ["content.created"],
  "adminPages": [],
  "env": []
}
```

## Full reference

| Field         | Type          | Required | Notes                                                                                |
| ------------- | ------------- | -------- | ------------------------------------------------------------------------------------ |
| `name`        | `string`      | yes      | NPM-style package name. Must match `/^[a-z0-9@/_-]+$/`.                              |
| `version`     | `string`      | yes      | Semver string, e.g. `"1.0.0"`.                                                       |
| `displayName` | `string`      | yes      | Human-readable name shown in the admin panel.                                        |
| `description` | `string`      | no       | Short description.                                                                   |
| `permissions` | `string[]`    | no       | Permissions the plugin requires (see below).                                         |
| `hooks`       | `string[]`    | no       | Lifecycle hooks the plugin subscribes to (see [Hooks reference](./hooks-reference)). |
| `adminPages`  | `AdminPage[]` | no       | Pages to add to the admin sidebar.                                                   |
| `env`         | `string[]`    | no       | Env var names the plugin reads. Missing vars appear as warnings in the admin.        |

## Permissions

```json
"permissions": [
  "content:read",
  "content:write",
  "settings:read",
  "settings:write",
  "media:read",
  "media:write"
]
```

Declare only what your plugin actually uses. Requesting unnecessary permissions makes it harder for admins to trust your plugin.

## Admin pages

```json
"adminPages": [
  {
    "label": "Meilisearch",
    "path": "/plugins/meilisearch",
    "icon": "Search"
  }
]
```

| Field   | Type     | Required | Notes                                              |
| ------- | -------- | -------- | -------------------------------------------------- |
| `label` | `string` | yes      | Sidebar label.                                     |
| `path`  | `string` | yes      | Route path inside the admin app.                   |
| `icon`  | `string` | no       | Lucide icon name (e.g. `"Search"`, `"BarChart2"`). |

## Env vars

Listing env var names in `env` lets the admin panel warn when they are not set:

```json
"env": ["MEILISEARCH_HOST", "MEILISEARCH_MASTER_KEY"]
```

Your plugin code still reads them via `process.env` — this field is metadata only.

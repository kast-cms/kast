---
title: Admin Panel Overview
description: A tour of the Kast admin panel — layout, navigation, and role-based access.
---

The Kast admin panel is a Next.js application served at `/admin`. It gives editors, admins, and super-admins a full UI for managing content, media, users, settings, and more.

## Layout

```
┌──────────────────────────────────────────────────┐
│  Topbar  [site name]  [search]  [notifications]  │
├────────────┬─────────────────────────────────────┤
│  Sidebar   │  Main Content Area                  │
│            │                                     │
│  Dashboard │                                     │
│  ─────     │                                     │
│  Content   │                                     │
│  ─────     │                                     │
│  Media     │                                     │
│  ─────     │                                     │
│  SEO       │                                     │
│  ─────     │                                     │
│  Settings  │                                     │
└────────────┴─────────────────────────────────────┘
```

## Sidebar sections

| Section            | Who can see it | Description                        |
| ------------------ | -------------- | ---------------------------------- |
| Dashboard          | All            | Stats, activity feed, queue health |
| Content Types      | ADMIN+         | Schema management                  |
| Content (per type) | EDITOR+        | Create and edit entries            |
| Media Library      | EDITOR+        | Upload and manage files            |
| SEO Manager        | EDITOR+        | SEO scores, sitemaps               |
| Users & Roles      | ADMIN+         | Manage users, roles, API tokens    |
| Webhooks           | ADMIN+         | Configure outbound webhooks        |
| Forms              | EDITOR+        | View form submissions              |
| Menus              | EDITOR+        | Build navigation menus             |
| Audit Log          | ADMIN+         | Full action history                |
| Settings           | SUPER_ADMIN    | Global configuration               |
| Queue Monitor      | SUPER_ADMIN    | BullMQ queue status                |

## Roles

| Role          | Permissions                                           |
| ------------- | ----------------------------------------------------- |
| `VIEWER`      | Read published content only                           |
| `EDITOR`      | Create and edit content, upload media                 |
| `ADMIN`       | All editor permissions + users, webhooks, audit       |
| `SUPER_ADMIN` | All permissions, including settings and queue monitor |

## Authentication

The admin panel uses JWT authentication. On login, it stores the access token (15-minute TTL) and refresh token in memory and an `HttpOnly` cookie respectively. Tokens are rotated on every refresh.

Sign in with email/password or via Google/GitHub OAuth (if configured).

## Keyboard shortcuts

| Shortcut           | Action                  |
| ------------------ | ----------------------- |
| `Cmd/Ctrl + K`     | Open command palette    |
| `Cmd/Ctrl + S`     | Save current entry      |
| `Cmd/Ctrl + Enter` | Save and publish        |
| `?`                | Show keyboard shortcuts |

## Topbar

- **Site name** — from `site.name` in Global Settings
- **Maintenance mode banner** — visible when `site.maintenanceMode = true`
- **User menu** — profile, connected OAuth accounts, logout

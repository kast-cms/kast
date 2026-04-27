---
title: Global Settings
description: Configure site identity, SMTP, storage, CORS, SEO defaults, and maintenance mode.
---

Global Settings (`SUPER_ADMIN` only) live at **Settings** in the sidebar. Changes take effect immediately — no restart needed.

## General tab

| Setting          | Key                    | Description                                             |
| ---------------- | ---------------------- | ------------------------------------------------------- |
| Site name        | `site.name`            | Shown in admin topbar and email subjects                |
| Logo             | `site.logo`            | Media file reference                                    |
| Favicon          | `site.favicon`         | Media file reference                                    |
| Site URL         | `site.url`             | Used in sitemaps, canonical URLs, password reset emails |
| Default locale   | `site.defaultLocale`   | Fallback for localized fields                           |
| Maintenance mode | `site.maintenanceMode` | Toggles delivery API offline                            |

### Maintenance mode

When enabled, all `GET /api/v1/delivery/*` requests return:

```json
{ "statusCode": 503, "error": "MAINTENANCE_MODE", "message": "Site is under maintenance" }
```

Admin API and panel remain accessible. A warning banner appears in the admin topbar.

## Email tab

Configure the SMTP server used for invites, password resets, and form notifications:

| Setting      | Key                                 |
| ------------ | ----------------------------------- |
| SMTP Host    | `smtp.host`                         |
| SMTP Port    | `smtp.port`                         |
| Username     | `smtp.user`                         |
| Password     | `smtp.password` (encrypted at rest) |
| From address | `smtp.from`                         |
| From name    | `smtp.fromName`                     |

Click **Send test email** to verify configuration.

## Storage tab

| Setting            | Key                        | Values                       |
| ------------------ | -------------------------- | ---------------------------- |
| Provider           | `storage.provider`         | `LOCAL`, `S3`, `R2`, `MINIO` |
| Max file size      | `storage.maxFileSizeMb`    | Default: 50                  |
| Allowed MIME types | `storage.allowedMimeTypes` | Comma-separated              |

Click **Test connection** to verify the storage provider is reachable.

## Security tab

| Setting              | Key                   |
| -------------------- | --------------------- |
| CORS allowed origins | `cors.allowedOrigins` |

Add origins as a tag input (e.g. `https://my-frontend.com`). The API dynamically applies the CORS policy from this list.

## SEO tab

| Setting                   | Key                          |
| ------------------------- | ---------------------------- |
| Default meta title suffix | `seo.defaultMetaTitle`       |
| Default meta description  | `seo.defaultMetaDescription` |
| Robots.txt                | `robots.txt`                 |

## Content tab

| Setting                  | Key                        | Notes                  |
| ------------------------ | -------------------------- | ---------------------- |
| Default entry status     | `content.defaultStatus`    | `DRAFT` or `PUBLISHED` |
| Version retention        | `content.versionRetention` | 0 = unlimited          |
| WebP image quality       | `media.imageQuality`       | 1–100, default 85      |
| Auto-generate thumbnails | `media.generateThumbnails` | Default: true          |

## API

```bash
# Get all settings
GET /api/v1/settings

# Update one or many
PATCH /api/v1/settings
{ "site.name": "My Blog", "site.maintenanceMode": false }

# Test SMTP
POST /api/v1/settings/test-smtp

# Test storage
POST /api/v1/settings/test-storage
```

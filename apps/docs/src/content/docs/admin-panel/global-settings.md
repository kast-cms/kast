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

Storage is configured by environment variables, not by these rows. The tab shows
the effective values read-only; the API rejects a `PATCH` that tries to set them.

| Setting            | Environment variable      | Notes               |
| ------------------ | ------------------------- | ------------------- |
| Provider           | `STORAGE_PROVIDER`        | `local`, `s3`, `r2` |
| Max file size      | `UPLOAD_MAX_FILE_SIZE_MB` | Default: 50         |
| Allowed MIME types | `UPLOAD_ALLOWED_MIME`     | Comma-separated     |

Click **Test connection** to write, read back and delete a probe object through
the configured provider.

## Security tab

| Setting      | Key            | Editable                                   |
| ------------ | -------------- | ------------------------------------------ |
| Robots.txt   | `robots.txt`   | Yes — served by `GET /v1/robots.txt`       |
| CORS origins | `CORS_ORIGINS` | No — environment variable, shown read-only |

CORS is applied from the `CORS_ORIGINS` environment variable at boot. It was
previously presented as an editable setting, but nothing ever read the stored
row, so changing it had no effect on the running policy.

## SEO tab

| Setting                   | Key                          |
| ------------------------- | ---------------------------- |
| Default meta title suffix | `seo.defaultMetaTitle`       |
| Default meta description  | `seo.defaultMetaDescription` |
| Robots.txt                | `robots.txt`                 |

## Content tab

These are shown read-only: they describe behaviour fixed in code or set by the
environment, and the API rejects a `PATCH` that tries to store them.

| Setting                  | Notes                                          |
| ------------------------ | ---------------------------------------------- |
| Default entry status     | New entries are created as `DRAFT`             |
| Version retention        | Versions are retained; no pruning is scheduled |
| WebP image quality       | Fixed in the media processor                   |
| Auto-generate thumbnails | Always on for supported image types            |

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

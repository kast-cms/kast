---
title: Settings API
description: Read and update global CMS configuration programmatically.
---

Requires `ADMIN+` for reads, `SUPER_ADMIN` for writes.

## Get all settings

```http
GET /api/v1/settings
Authorization: Bearer <token>
```

Returns all key-value pairs. Secret values (SMTP password, etc.) are redacted as `"***"`.

## Update settings

```http
PATCH /api/v1/settings
Authorization: Bearer <token>   (SUPER_ADMIN)
Content-Type: application/json

{
  "site.name": "My Blog",
  "site.maintenanceMode": false,
  "media.imageQuality": 90
}
```

Multiple keys can be updated in one request. Returns the updated settings object.

## Test SMTP

```http
POST /api/v1/settings/test-smtp
Authorization: Bearer <token>   (SUPER_ADMIN)
```

Sends a test email using the current SMTP configuration. Returns `200` on success or `400` with the SMTP error.

## Test storage

```http
POST /api/v1/settings/test-storage
Authorization: Bearer <token>   (SUPER_ADMIN)
```

Writes and reads a small test file to verify storage provider connectivity.

## Settings key reference

| Key                          | Type     | Default                     |
| ---------------------------- | -------- | --------------------------- |
| `site.name`                  | string   | `"Kast CMS"`                |
| `site.url`                   | string   | `"http://localhost:3000"`   |
| `site.defaultLocale`         | string   | `"en"`                      |
| `site.maintenanceMode`       | boolean  | `false`                     |
| `smtp.host`                  | string   | —                           |
| `smtp.port`                  | number   | `587`                       |
| `smtp.from`                  | string   | —                           |
| `storage.provider`           | enum     | `"LOCAL"`                   |
| `storage.maxFileSizeMb`      | number   | `50`                        |
| `cors.allowedOrigins`        | string[] | `[]`                        |
| `robots.txt`                 | string   | `"User-agent: *\nAllow: /"` |
| `seo.defaultMetaTitle`       | string   | —                           |
| `seo.defaultMetaDescription` | string   | —                           |
| `content.defaultStatus`      | enum     | `"DRAFT"`                   |
| `content.versionRetention`   | number   | `0` (unlimited)             |
| `media.imageQuality`         | number   | `85`                        |
| `media.generateThumbnails`   | boolean  | `true`                      |

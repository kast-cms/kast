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
  "settings": [
    { "key": "site.name", "value": "My Blog" },
    { "key": "site.url", "value": "https://example.com", "isPublic": true },
    { "key": "site.maintenanceMode", "value": false }
  ]
}
```

Multiple keys can be updated in one request. `isPublic` publishes the row through
`GET /api/v1/delivery/settings`; omit it to leave the current visibility alone.
Secret keys stay private regardless of what is asked for.

A key the runtime does not read is rejected with `400` naming the real source,
and the **whole batch** is refused rather than partially applied — see below.

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

Writes a probe object through the live storage adapter, reads it back, compares
the bytes and deletes it. Returns the provider actually in use plus per-step
results:

```json
{ "provider": "LOCAL", "status": "ok", "checks": { "write": true, "read": true, "delete": true } }
```

A failure is `400` carrying the backend's own message. `STORAGE_PROVIDER=gcs`
returns a warning, because it silently falls back to the local adapter.

## Settings key reference

Every key below is read by a real code path, named in `enforcedBy` on the
response. A stored setting that nothing consumes is worse than no setting at
all, so the API withholds and refuses the inert ones (see the next section).

| Key                          | Type     | Read by                                                      |
| ---------------------------- | -------- | ------------------------------------------------------------ |
| `site.name`                  | string   | `GET /delivery/settings`, when the row is public             |
| `site.url`                   | string   | `GET /delivery/settings`, when the row is public             |
| `site.maintenanceMode`       | boolean  | `MaintenanceMiddleware` — 503s `/delivery` routes while true |
| `smtp.host`                  | string   | `POST /settings/test-smtp`                                   |
| `smtp.port`                  | number   | `POST /settings/test-smtp`                                   |
| `smtp.user`                  | string   | `POST /settings/test-smtp`                                   |
| `smtp.password`              | secret   | `POST /settings/test-smtp`                                   |
| `smtp.from`                  | string   | `POST /settings/test-smtp`                                   |
| `smtp.fromName`              | string   | `POST /settings/test-smtp`                                   |
| `robots.txt`                 | string   | `GET /v1/robots.txt`                                         |
| `seo.defaultMetaTitle`       | string   | SEO scoring and the delivery payload fallback                |
| `seo.defaultMetaDescription` | string   | SEO scoring and the delivery payload fallback                |
| `seo.gate.defaultPolicy`     | enum     | The publish gate — `enforce` / `advisory` / `disabled`       |
| `seo.gate.contentTypes`      | object   | Per-content-type override of the gate policy                 |
| `seo.redirects.allowedHosts` | string[] | Redirect target policy — off-site targets must be listed     |

:::caution
Queued mail is still sent with the `SMTP_*` environment variables. The `smtp.*`
settings are read only by the test endpoint.
:::

## Keys governed by the environment

These were previously writable but nothing ever read them, so saving appeared to
work and changed nothing. They are no longer returned by `GET /settings` and a
`PATCH` naming one is rejected with `400` pointing at the real source.

| Key                        | Real source                           |
| -------------------------- | ------------------------------------- |
| `storage.provider`         | `STORAGE_PROVIDER`                    |
| `storage.maxFileSizeMb`    | `UPLOAD_MAX_FILE_SIZE_MB`             |
| `storage.allowedMimeTypes` | `UPLOAD_ALLOWED_MIME_TYPES`           |
| `cors.allowedOrigins`      | `CORS_ORIGINS`, applied at bootstrap  |
| `media.imageQuality`       | Fixed in the media worker             |
| `media.generateThumbnails` | Fixed in the media worker (always on) |
| `content.defaultStatus`    | Fixed — a new entry is always `DRAFT` |
| `content.versionRetention` | Fixed — versions are never pruned     |

Keys absent from both tables are treated as caller-defined data: stored and
returned untouched.

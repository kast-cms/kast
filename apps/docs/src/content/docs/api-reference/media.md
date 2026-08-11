---
title: Media API
description: Upload, list, update, and delete media files.
---

## Upload

```http
POST /api/v1/media
Authorization: Bearer <token>
Content-Type: multipart/form-data

file=@photo.jpg
folderId=<optional-folder-id>
```

**Response:** `201 Created` with the `MediaFile` object.

## List media

```http
GET /api/v1/media
Authorization: Bearer <token>
```

Query: `?limit=20&cursor=<cursor>&folderId=<id>&mimeType=image/jpeg`

## Get file metadata

```http
GET /api/v1/media/:id
Authorization: Bearer <token>
```

## Serving the object itself

Under the default `local` storage provider, the bytes are served by:

```http
GET /api/v1/media/files/<storageKey>
```

This route is **public and unauthenticated** by design: media URLs are handed to
anonymous readers by the Delivery API and rendered in plain `<img>` tags, which
is exactly what a public S3/R2 bucket does. It serves bytes by opaque storage key
only — there is no listing and no metadata — so an unknown key is a `404`, never
a `401`. The route answers `404` for every key when a remote provider is active,
so switching to S3 or R2 cannot leave a reader on the local directory.

`STORAGE_LOCAL_URL` is the public base URL written into each row's `url`; it
defaults to this route.

Hardening: the content type is resolved from the key's extension and never from
the client; keys containing `..`, dotfile segments, backslashes or NUL are
refused, and the resolved path is re-checked for containment after `realpath` so
a symlink cannot escape the upload directory. Every response carries
`X-Content-Type-Options: nosniff` and
`Content-Security-Policy: default-src 'none'; sandbox`. Only a fixed raster/AV
set is served inline; everything else — SVG and PDF included — is sent as
`Content-Disposition: attachment`.

:::caution
With S3 or R2 the bucket serves the object and decides its own
`Content-Disposition`, so the forced download applied here does not follow.
:::

## Update metadata

```http
PATCH /api/v1/media/:id
Authorization: Bearer <token>

{ "alt": "A sunset photo", "filename": "sunset.jpg", "folderId": "<id>" }
```

## Delete

```http
DELETE /api/v1/media/:id
Authorization: Bearer <token>
```

Moves to trash and **keeps the stored object** — trash restore only clears
`trashedAt`, so dropping the bytes here would restore a broken row.

Permanent deletion is `DELETE /api/v1/trash/media/:id` (SUPER_ADMIN). That
releases the object along with its thumbnails and the pre-optimisation original.
The retention job does the same after 30 days.

## Folders

```http
GET    /api/v1/media/folders
POST   /api/v1/media/folders          { "name": "Blog Images", "parentId": null }
PATCH  /api/v1/media/folders/:id      { "name": "Updated Name" }
DELETE /api/v1/media/folders/:id
```

## MediaFile object

```json
{
  "id": "clxyz...",
  "filename": "photo.jpg",
  "mimeType": "image/jpeg",
  "size": 204800,
  "url": "https://cdn.example.com/photo.jpg",
  "width": 1920,
  "height": 1080,
  "alt": "A sunset photo",
  "folderId": null,
  "createdAt": "2026-01-01T00:00:00Z"
}
```

## Validation errors

| Code                    | Cause                                 |
| ----------------------- | ------------------------------------- |
| `FILE_TOO_LARGE`        | Exceeds `UPLOAD_MAX_FILE_SIZE_MB`     |
| `MIME_TYPE_NOT_ALLOWED` | MIME type not in allowed list         |
| `FILE_TYPE_MISMATCH`    | Magic bytes don't match declared MIME |

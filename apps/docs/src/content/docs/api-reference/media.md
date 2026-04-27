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

## Get file

```http
GET /api/v1/media/:id
Authorization: Bearer <token>
```

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

Moves to trash. Permanent deletion via `DELETE /api/v1/trash/:id`.

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

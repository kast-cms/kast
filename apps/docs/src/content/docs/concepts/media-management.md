---
title: Media Management
description: Upload, organise, and serve images and files through the Kast media library.
---

Kast includes a built-in media library. Every uploaded file is processed by a BullMQ job that generates WebP variants and thumbnails, then stored in the configured storage provider.

## Uploading a file

```bash
POST /api/v1/media
Authorization: Bearer <token>
Content-Type: multipart/form-data

file=@/path/to/image.jpg
```

Response:

```json
{
  "data": {
    "id": "clxyz...",
    "filename": "image.jpg",
    "mimeType": "image/jpeg",
    "size": 204800,
    "url": "http://localhost:3000/uploads/image.jpg",
    "width": 1920,
    "height": 1080,
    "alt": null,
    "folderId": null
  }
}
```

## File validation

Kast validates uploaded files at two levels:

1. **Declared MIME type** — checked against the `UPLOAD_ALLOWED_MIME_TYPES` env var.
2. **Magic bytes** — the actual file header is inspected to prevent MIME spoofing (e.g. a `.php` file renamed to `.jpg` is rejected).

Default allowed types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/svg+xml`, `application/pdf`.

Maximum file size is set via `UPLOAD_MAX_FILE_SIZE_MB` (default: 50 MB).

## Image processing

After upload, a `kast.media` BullMQ job:

1. Converts the image to WebP (quality configurable via Global Settings).
2. Generates a 400×300 thumbnail.
3. Extracts width, height, and file size metadata.

Processed variants are stored alongside the original.

## Storage providers

| Provider | Config                                   | Notes                               |
| -------- | ---------------------------------------- | ----------------------------------- |
| `local`  | `STORAGE_LOCAL_DIR`, `STORAGE_LOCAL_URL` | Default, good for development       |
| `s3`     | `AWS_*` env vars                         | AWS S3 or S3-compatible             |
| `r2`     | `R2_*` env vars                          | Cloudflare R2 via `@kast/plugin-r2` |

Set `STORAGE_PROVIDER` in your `.env` to switch providers.

## Folders

Organise media into folders:

```bash
# Create a folder
POST /api/v1/media/folders
{ "name": "Blog Images", "parentId": null }

# Move a file to a folder
PATCH /api/v1/media/:id
{ "folderId": "<folder-id>" }
```

## Updating metadata

```bash
PATCH /api/v1/media/:id
Authorization: Bearer <token>

{
  "alt": "A sunset over the mountains",
  "filename": "sunset.jpg"
}
```

The `alt` field is used for accessibility and SEO. Set it for every image.

## Deleting a file

```bash
DELETE /api/v1/media/:id
Authorization: Bearer <token>
```

Soft-deletes the record and moves it to trash. The physical file is removed after 30 days or on permanent trash deletion.

## SDK usage

```ts
// Upload
const formData = new FormData();
formData.append('file', fileBlob, 'photo.jpg');
const { data: file } = await kast.media.upload(formData);

// List
const { data: files } = await kast.media.list({ limit: 20 });

// Update alt text
await kast.media.update(file.id, { alt: 'A photo of the team' });
```

---
title: Media Library
description: Upload, organise, and manage images and files in the Kast media library.
---

The media library gives `EDITOR+` users a visual browser for all uploaded files.

## Grid and list view

Toggle between grid (thumbnail) and list (table) view. Grid view shows image previews; list view shows filename, size, MIME type, and upload date.

## Uploading files

Drag and drop files onto the library or click **Upload**. Multiple files can be uploaded at once. Kast validates each file against the allowed MIME types and size limits before accepting it.

During upload, a progress bar shows the status of each file. After upload, images are queued for WebP conversion and thumbnail generation (usually completes within a few seconds).

## Folders

Create folders to organise your media:

1. Click **New Folder**.
2. Enter a name.
3. Drag files into the folder, or use the **Move** action on a file.

Folders can be nested. The breadcrumb shows your current path.

## File detail

Click a file to open its detail panel:

- Full-resolution preview (images)
- Filename, MIME type, dimensions (images), file size
- **Alt text** — editable, important for SEO and accessibility
- **Copy URL** button — copies the direct media URL
- **Copy ID** button — copies the media file ID for use in content fields

## Selecting media from content fields

When editing a content entry with a `media` field, clicking the field opens a modal version of the media library. Select a file to link it to the field.

## Deleting files

Select one or more files and click **Delete**. Files are moved to trash. Trashed media is recoverable for 30 days via the Trash page.

:::caution
Deleting a media file does not remove references to it in content entries. Those entries will have a broken media link until updated.
:::

## Search and filter

- **Search** by filename (substring match)
- **Filter by type**: Images, Videos, Documents, Other
- **Sort by**: Upload date (newest first), Name, Size

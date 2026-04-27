---
title: Media
description: Upload and manage media files with the SDK.
sidebar:
  order: 5
---

## Upload a file

```ts
const formData = new FormData();
formData.append('file', fileBlob, 'photo.jpg');

const { data: file } = await kast.media.upload(formData);
console.log(file.url); // CDN URL
```

### With folder

```ts
formData.append('folderId', '<folder-id>');
const { data: file } = await kast.media.upload(formData);
```

## List media

```ts
const { data: files, meta } = await kast.media.list({
  limit: 20,
  cursor: undefined,
  folderId: undefined,
});
```

## Get a file

```ts
const { data: file } = await kast.media.get(fileId);
```

## Update metadata

```ts
const { data: file } = await kast.media.update(fileId, {
  alt: 'A photo of the team',
  filename: 'team-photo.jpg',
});
```

## Delete

```ts
await kast.media.delete(fileId);
// Moves to trash
```

## Folders

```ts
// List folders
const { data: folders } = await kast.media.listFolders();

// Create folder
const { data: folder } = await kast.media.createFolder({
  name: 'Blog Images',
  parentId: null,
});

// Delete folder (must be empty)
await kast.media.deleteFolder(folderId);
```

## MediaFile type

```ts
interface MediaFile {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  folderId?: string;
  createdAt: string;
}
```

## Usage in Next.js Image

```tsx
import Image from 'next/image';

const { data: file } = await kast.media.get(mediaId);

<Image src={file.url} alt={file.alt ?? ''} width={file.width ?? 800} height={file.height ?? 600} />;
```

---
title: Versions
description: List and revert content entry versions with the SDK.
sidebar:
  order: 11
---

Every save to a content entry creates a new version. Versions are immutable snapshots that you can list, inspect, and revert to.

## List versions

```ts
const { data: versions, meta } = await kast.versions.list('blog-post', entryId, {
  limit: '20',
});
```

## Get a specific version

```ts
const { data: version } = await kast.versions.get('blog-post', entryId, versionId);
// { id, versionNumber, status, data, savedById, savedByName, createdAt }
```

## Revert to a version

Creates a new DRAFT with the content from the chosen snapshot. The existing published version is not affected until you re-publish.

```ts
const { data: entry } = await kast.versions.revert('blog-post', entryId, versionId);
// Returns the entry in DRAFT status with the reverted data
```

---

## Via content resource (shorthand)

`kast.content` exposes the same operations directly:

```ts
// List versions
const { data: versions } = await kast.content.listVersions('blog-post', entryId);

// Get a version
const { data: v } = await kast.content.getVersion('blog-post', entryId, versionId);

// Revert
const { data: entry } = await kast.content.revert('blog-post', entryId, versionId);
```

---

## Version type

```ts
interface ContentEntryVersion {
  id: string;
  versionNumber: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'SCHEDULED';
  data: Record<string, unknown>;
  savedById: string;
  savedByName: string | null;
  createdAt: string;
}
```

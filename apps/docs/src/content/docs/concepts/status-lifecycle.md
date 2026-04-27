---
title: Status Lifecycle
description: Understand how content entries move between Draft, Published, Scheduled, Archived, and Trashed states.
---

Every content entry has a `status` field that controls its visibility and behaviour.

## States

| Status      | Visible via Delivery API | Description                              |
| ----------- | ------------------------ | ---------------------------------------- |
| `DRAFT`     | No                       | Work in progress. Default on creation.   |
| `PUBLISHED` | Yes                      | Live and publicly accessible.            |
| `SCHEDULED` | No                       | Will auto-publish at `scheduledAt`.      |
| `ARCHIVED`  | No                       | Manually taken offline. Stays in the DB. |
| `TRASHED`   | No                       | Soft-deleted. Recoverable for 30 days.   |

## Transitions

```
DRAFT ──────────────────────────────→ PUBLISHED
  │                                       │
  │                                   unpublish
  ▼                                       ▼
SCHEDULED ──(scheduledAt fires)──→ PUBLISHED   ARCHIVED
  │
  └──(cancel)──→ DRAFT

Any status ──(trash)──→ TRASHED ──(restore)──→ DRAFT
TRASHED ──(30 days)──→ hard deleted
```

## Publishing

```bash
POST /api/v1/content-types/:typeSlug/entries/:id/publish
Authorization: Bearer <token>
```

Sets `status = PUBLISHED` and records a `content.publish` audit event.

## Unpublishing

```bash
POST /api/v1/content-types/:typeSlug/entries/:id/unpublish
Authorization: Bearer <token>
```

Sets `status = ARCHIVED`. The entry is no longer returned by the Delivery API.

## Scheduling

```bash
POST /api/v1/content-types/:typeSlug/entries/:id/schedule
Authorization: Bearer <token>

{ "scheduledAt": "2026-06-01T09:00:00Z" }
```

A BullMQ job in the `kast.publish` queue fires at `scheduledAt` and runs the publish transition automatically. If the scheduled time passes while the queue is paused, the job fires as soon as the queue resumes.

## Trashing

```bash
DELETE /api/v1/content-types/:typeSlug/entries/:id
Authorization: Bearer <token>
```

Moves to `TRASHED`. The entry is hidden everywhere but remains in the database. See [Trash & Recovery](/concepts/trash-recovery/).

## Delivery API and status

The public delivery API only returns `PUBLISHED` entries by default:

```bash
GET /api/v1/content-types/blog-post/entries
# returns only PUBLISHED entries
```

Authenticated requests can filter by status:

```bash
GET /api/v1/content-types/blog-post/entries?status=DRAFT
Authorization: Bearer <editor-token>
```

## Version on every save

Each time an entry is saved (regardless of status transition), a `ContentEntryVersion` snapshot is created. You can view, compare, and revert to any previous version. See [Versioning](/concepts/versioning/).

---
title: Queue Monitor
description: Monitor and manage BullMQ background job queues as SUPER_ADMIN.
---

The Queue Monitor (`SUPER_ADMIN` only) is powered by [Bull Board](https://github.com/felixmosh/bull-board) and accessible at `/admin/queues`.

## Queues

Kast runs 6 BullMQ queues:

| Queue          | Purpose                                                                  |
| -------------- | ------------------------------------------------------------------------ |
| `kast.webhook` | Deliver outbound webhook payloads with retry logic                       |
| `kast.media`   | Process uploaded images — WebP conversion, thumbnails                    |
| `kast.seo`     | Run SEO validation on published entries                                  |
| `kast.publish` | Fire scheduled entry publishes at their `scheduledAt` time               |
| `kast.trash`   | Daily cron — permanently delete items trashed > 30 days                  |
| `kast.email`   | Send transactional emails (invites, password resets, form notifications) |

## Queue status

Each queue row shows:

| Column    | Description                           |
| --------- | ------------------------------------- |
| Waiting   | Jobs queued, not yet started          |
| Active    | Jobs currently running                |
| Completed | Jobs finished successfully (last 100) |
| Failed    | Jobs that exhausted all retries       |
| Delayed   | Jobs scheduled for a future time      |

A red row means `failed > 0`. Click the queue name for job-level detail.

## Job detail

Click a job to see:

- Job ID and attempt number
- Input payload (JSON)
- Return value or error stack trace
- Timestamps: created, started, finished

## Actions

| Action            | Who         | Description                                 |
| ----------------- | ----------- | ------------------------------------------- |
| Retry             | SUPER_ADMIN | Re-queues a failed job immediately          |
| Remove            | SUPER_ADMIN | Permanently removes a completed/failed job  |
| Pause queue       | SUPER_ADMIN | Stops processing new jobs (logged to audit) |
| Resume queue      | SUPER_ADMIN | Resumes a paused queue                      |
| Clean dead-letter | SUPER_ADMIN | Removes all failed jobs from a queue        |

Pause/resume actions are written to the audit log with the actor's identity.

## Dashboard integration

The [Dashboard](/admin-panel/overview/) shows a queue health summary in the bottom row (ADMIN+). Red rows link directly to the Queue Monitor for that queue.

## Access control

The `/admin/queues` route requires a valid `SUPER_ADMIN` JWT. Accessing it as any other role returns `403 Forbidden`.

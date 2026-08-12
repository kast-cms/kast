---
title: Multi-instance Deployment
description: Run Kast safely with multiple API replicas and shared state.
---

Kast supports multiple API replicas when every replica uses the same PostgreSQL,
Redis, object storage, secrets, and plugin set.

## Required shared services

- Use managed PostgreSQL or one highly available cluster.
- Use durable Redis with AOF (or a managed equivalent). OAuth authorization
  codes and BullMQ coordination live here, so no sticky sessions are required.
- Use S3 or R2 for media. `STORAGE_PROVIDER=local` is supported only for one API
  replica unless all replicas mount the same durable, read-write filesystem at
  exactly `STORAGE_LOCAL_DIR`.
- Deploy identical plugin artifacts and configuration to every replica.

MCP uses stateless Streamable HTTP requests. Clients may reach any replica. All
authorization and audit records use shared state.

## Scheduled work

Every replica may register the schedulers. Publish reconciliation uses guarded
PostgreSQL updates, so one due entry can transition only once. The daily trash
scheduler uses a date-based BullMQ job ID, so Redis deduplicates replicas. Worker
handlers are idempotent where possible; external email and webhook systems remain
at-least-once and must use the delivery identifiers described in the operations
runbook.

## Deployment order

1. Run `prisma migrate deploy` once as a release job.
2. Roll API replicas with readiness checks enabled.
3. Roll the admin and public frontend.
4. Verify `/api/v1/health/ready`, queue depth, a media read, and an authenticated
   MCP `tools/list` request.

Do not let every replica race a destructive rollback. Follow the backup and
forward-migration procedure in the [operations runbook](./operations-runbook/).

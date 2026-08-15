---
title: Operations Runbook
description: Back up, restore, migrate, rotate secrets, and recover queues safely.
---

Use this runbook before upgrades and during incident recovery. Commands assume
the repository Compose stack and an `.env` in the repository root.

## Backup

Back up PostgreSQL and uploaded objects together. Redis is durable (AOF is
enabled) but is not authoritative: scheduled publishes are reconciled from
PostgreSQL, while retained queue jobs can be recreated or replayed.

```bash
mkdir -p backups
docker compose exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > backups/kast.dump
docker run --rm -v kast_uploads:/source:ro -v "$PWD/backups:/backup" \
  alpine tar -C /source -czf /backup/uploads.tar.gz .
```

For S3/R2, use bucket versioning plus the provider's inventory or replication
feature instead of copying the local `uploads` volume. Encrypt backups, restrict
their IAM principal, and test a restore at least quarterly.

## Restore

Restore into an empty database, then restore media from the same backup point.

```bash
docker compose stop api admin
docker compose exec -T postgres sh -c \
  'dropdb -U "$POSTGRES_USER" --if-exists kast_restore'
docker compose exec -T postgres sh -c \
  'createdb -U "$POSTGRES_USER" kast_restore'
docker compose exec -T postgres sh -c \
  'pg_restore -U "$POSTGRES_USER" -d kast_restore --clean --if-exists' \
  < backups/kast.dump
```

Point a staging API at `kast_restore`, start it, and check `/api/v1/health/ready`
before promoting it. Never test a restore over the only production database.

## Migrations and rollback

The API image runs `prisma migrate deploy` before accepting traffic. Before an
upgrade:

1. Read every new `apps/api/prisma/migrations/*/migration.sql`.
2. Take and verify a database backup.
3. Deploy to staging and run the readiness probe.
4. For multiple replicas, run one migration job first, then roll the API image.

Released Prisma migrations are immutable. Do not rename, edit, or split an
applied migration. Prefer a forward corrective migration. If an upgrade must be
rolled back and its schema is not backward-compatible, stop writers, restore the
pre-upgrade database and media backup, then redeploy the previous image.

## Secret rotation

- `JWT_SECRET`: replace it and restart every replica together. Existing access
  tokens stop working; revoke or expire refresh tokens if the incident requires
  a full sign-out.
- `KAST_SECRET_ENCRYPTION_KEY`: set a new active key and place the old key in
  `KAST_SECRET_ENCRYPTION_PREVIOUS_KEYS`. Restart, exercise saved SMTP settings,
  each plugin configuration, and each webhook so values are lazily re-encrypted.
  Then remove the previous key and restart. Keep the old key in the encrypted
  incident record until backup retention expires.
- Webhook secrets, OAuth client secrets, SMTP credentials, and provider keys:
  rotate at the provider, update Kast, verify, then revoke the retired value.
- `POSTGRES_PASSWORD` and `REDIS_PASSWORD`: schedule a maintenance window,
  change the server and `.env` values together, and restart all replicas.

## Failed jobs and replay

Jobs that exhaust retries remain in BullMQ as the dead-letter set and are visible
to `SUPER_ADMIN` in Queue Monitor. Inspect the payload and error before replay.
Fix permanent causes first (credentials, egress policy, SMTP, storage).

Replay individual jobs in Bull Board, or replay a bounded batch:

```http
POST /api/v1/queue-operations/kast.webhook/replay-failed?limit=100
Authorization: Bearer <super-admin-jwt>
```

The same endpoint accepts `kast.media`, `kast.seo`, `kast.publish`,
`kast.email`, and `kast.trash`. Webhooks include both `X-Kast-Delivery` and
`Idempotency-Key`; receivers should persist that value and return the prior
result for duplicates. Media, SEO, publish, and daily trash jobs use stable job
IDs or guarded database updates. Email delivery is at-least-once, so confirm an
email was not already accepted before replaying it.

Monitor `/api/v1/health/ready`. It fails when a worker is missing or a queue
crosses `QUEUE_BACKLOG_ALERT_THRESHOLD` or `QUEUE_FAILED_ALERT_THRESHOLD`.
Alert on a non-200 response and on repeated flapping; do not simply raise the
threshold without explaining the backlog.

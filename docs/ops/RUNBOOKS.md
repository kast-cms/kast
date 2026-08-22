# Kast CMS — Operations Runbooks

Procedures for backup, restore, migration rollback, secret rotation, and disaster
recovery. Every command below is written against the `docker-compose.yml` at the
repository root; on a managed platform substitute your own host, credentials, and
volume names, but keep the ordering — it is the ordering that matters.

**Status of these procedures:** written against the shipped code and configuration
and reviewed line by line, but the full restore and failover drills have not been
executed against a production-sized dataset. Run [the drill](#8-drill-schedule)
before you depend on them.

---

## 0. What state exists

Four independent stores. A restore is only consistent if you know which of them
you took, and when.

| Store           | Holds                                                                   | Loss impact                             | Backed up by |
| --------------- | ----------------------------------------------------------------------- | --------------------------------------- | ------------ |
| PostgreSQL      | All content, users, tokens, settings, audit log, plugin rows            | Total                                   | §1           |
| Object storage  | Uploaded media and its derivatives                                      | Media 404s; rows survive                | §2           |
| Redis           | Queues, delayed publish jobs, OAuth exchange codes, Bull Board sessions | Recoverable — see below                 | §3           |
| Secret material | `JWT_SECRET`, `KAST_SECRET_ENCRYPTION_KEY`                              | **Encrypted columns become unreadable** | §6           |

Redis is deliberately _not_ the source of truth. Scheduled publishing reconciles
from the database every minute (`PublishReconciliationService`), and the daily
trash purge re-enqueues itself, so a Redis loss delays work rather than dropping
it. What does not survive a Redis flush: in-flight webhook retries and unclaimed
OAuth authorization codes (users retry the login).

The database alone is not a complete backup. `GlobalSetting`, `WebhookEndpoint.secretHash`
and `PluginConfig.data` hold ciphertext keyed to `KAST_SECRET_ENCRYPTION_KEY`. A
database dump restored without that key leaves those rows permanently undecryptable.
**Back the key up separately, and never in the same store as the dump.**

---

## 1. PostgreSQL backup and restore

### 1.1 Take a backup

```bash
docker compose exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-kast}" -d "${POSTGRES_DB:-kast_db}" \
  --format=custom --compress=9 \
  > "kast-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

`--format=custom` (not plain SQL) is what makes §1.3 selective restore possible.

Verify the dump is readable before you trust it — a truncated dump lists nothing:

```bash
pg_restore --list kast-<stamp>.dump | head
```

### 1.2 Full restore

Restoring replaces live data. Stop writers first so nothing lands between the
drop and the load.

```bash
docker compose stop api admin

docker compose exec -T postgres \
  dropdb -U "${POSTGRES_USER:-kast}" --if-exists "${POSTGRES_DB:-kast_db}"
docker compose exec -T postgres \
  createdb -U "${POSTGRES_USER:-kast}" "${POSTGRES_DB:-kast_db}"

docker compose exec -T postgres \
  pg_restore -U "${POSTGRES_USER:-kast}" -d "${POSTGRES_DB:-kast_db}" --no-owner \
  < kast-<stamp>.dump

docker compose up -d api admin
```

The API applies `prisma migrate deploy` on start, so a dump from an older schema
is migrated forward automatically. A dump from a _newer_ schema than the image
will not be migrated backward — see §5.

### 1.3 Restore one table

For an accidental bulk delete, restore into a scratch database and copy the rows
across rather than rolling the whole instance back:

```bash
docker compose exec -T postgres createdb -U kast kast_restore
docker compose exec -T postgres \
  pg_restore -U kast -d kast_restore --no-owner < kast-<stamp>.dump
# then: INSERT INTO "ContentEntry" SELECT * FROM kast_restore."ContentEntry" WHERE ...
```

Prefer the trash: soft-deleted rows are recoverable from the admin until the
retention window closes, and that path restores related rows correctly.

### 1.4 Verify

```bash
curl -fsS http://localhost:3000/api/v1/health
curl -fsS http://localhost:3000/api/v1/health/ready
```

`/health` is database + Redis. `/health/ready` additionally probes storage and the
workers — use that one after a restore. Then confirm an encrypted column still
decrypts (Settings → Email → **Send test email**); if it fails, you restored the
data without the matching key (§6.3).

---

## 2. Object storage

### `STORAGE_PROVIDER=local`

Bytes live in the `uploads` volume, mounted at `/tmp/kast-uploads`.

```bash
# Back up
docker run --rm -v kast_uploads:/data -v "$PWD":/backup alpine \
  tar czf /backup/kast-uploads-$(date -u +%Y%m%dT%H%M%SZ).tar.gz -C /data .

# Restore
docker run --rm -v kast_uploads:/data -v "$PWD":/backup alpine \
  sh -c 'rm -rf /data/* && tar xzf /backup/kast-uploads-<stamp>.tar.gz -C /data'
```

Check the volume name with `docker volume ls` — Compose prefixes it with the
project directory.

Local storage is single-node. See [MULTI_INSTANCE.md](./MULTI_INSTANCE.md) before
running more than one API replica.

### `STORAGE_PROVIDER=s3` / `r2`

Use the provider's own versioning and replication; do not roll your own copy job.
Enable **object versioning** and a lifecycle rule that retains noncurrent versions
for at least as long as your database backup retention. That combination is what
makes §7 possible: media and rows can be restored to the same point in time.

### Reconciling media against the database

After any restore where the two stores came from different moments, expect drift
in one of two directions:

- **Row without object** → the file 404s. Re-upload, or trash the row.
- **Object without row** → invisible bytes. Reclaimed only by a permanent delete
  that names them, which no longer happens once the row is gone. Sweep the bucket
  against `MediaFile.storageKey` and delete the orphans manually.

---

## 3. Redis

Redis runs with AOF enabled (`--appendonly yes`) and a password, and its port is
not published. Persistence is in the `redis_data` volume.

```bash
docker compose exec redis redis-cli -a "$REDIS_PASSWORD" --no-auth-warning BGREWRITEAOF
docker run --rm -v kast_redis_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/kast-redis-$(date -u +%Y%m%dT%H%M%SZ).tar.gz -C /data .
```

Restoring Redis is rarely the right move — a stale queue replays work that has
already happened. Prefer starting with an empty Redis and letting reconciliation
refill it:

```bash
docker compose stop api
docker volume rm kast_redis_data
docker compose up -d redis api
```

Within a minute, due scheduled entries publish; the trash purge re-enqueues at
02:00 UTC. Failed webhook deliveries are retained and replayable:

```bash
curl -fsS -X POST -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  'http://localhost:3000/api/v1/queue-operations/kast.webhook/replay-failed?limit=100'
```

---

## 4. Cache purge and frontend revalidation

Kast emits publish/unpublish webhooks; CDN and frontend cache invalidation should
hang off those events rather than polling content. Configure one webhook per
delivery surface and keep the receiver idempotent.

### Vercel / Next.js

Create a Kast webhook for `content.published`, `content.unpublished`,
`content.scheduled`, and `content.trashed` that calls a protected route in the
frontend, for example `/api/revalidate`. The frontend route should verify the
Kast webhook signature, derive the affected path or tag from the entry payload,
then call `revalidatePath` or `revalidateTag`.

### Fastly and other CDNs

Prefer surrogate-key purges over whole-site purges. Use stable keys such as
`content:<type>`, `entry:<id>`, and `locale:<code>` in frontend responses, then
let the webhook receiver call the provider purge API for only those keys. If the
provider does not support surrogate keys, purge the canonical entry path and the
content-type listing pages that can reference it.

### Validation

After wiring a receiver, publish and unpublish a test entry and confirm:

1. Kast records a successful webhook delivery.
2. The frontend cache contains the new content without manual refresh.
3. Reverting or trashing the entry purges every path that linked to it.

---

## 5. Migration rollback

Prisma migrations are forward-only. There is no `migrate down`, and generating a
reverse migration by hand for a schema of this size is not a procedure you want to
be inventing during an incident.

**The supported rollback is: restore the database (§1.2) to a dump taken before
the deploy, then deploy the matching older image.** This is why §8 pairs a backup
with every release.

Consequences to plan for:

1. **Take a dump immediately before every deploy that carries a migration.** Check
   `apps/api/prisma/migrations/` in the diff; if it has a new directory, dump first.
2. **A newer dump cannot be loaded into an older image.** Restore direction is
   only backwards in time.
3. **Additive migrations are usually rollback-safe without a restore** — a dropped
   column is not, an added nullable column is. Read the SQL.

To roll forward instead (usually preferable): write a new migration that reverses
the change, and deploy it as an ordinary release.

To check what an image would apply before it applies it:

```bash
docker compose run --rm --entrypoint sh api -c 'node_modules/.bin/prisma migrate status'
```

---

## 6. Secret rotation

### 6.1 `JWT_SECRET`

Signs access tokens, and is the _fallback_ encryption key when
`KAST_SECRET_ENCRYPTION_KEY` is unset. Production validation rejects that fallback,
so on a correctly configured production instance `JWT_SECRET` signs tokens only and
rotates freely:

```bash
# .env
JWT_SECRET=$(openssl rand -base64 48)
```

```bash
docker compose up -d --force-recreate api
```

Effect: every access token is rejected immediately; refresh tokens are opaque
database rows and survive, so clients recover on their next refresh. Admin sessions
continue.

**If `KAST_SECRET_ENCRYPTION_KEY` was never set** (development, or a production
instance that predates the check), `JWT_SECRET` is also encrypting your settings,
webhook, and plugin secrets. Rotating it alone makes all of them undecryptable.
Do §6.2 first, listing the old `JWT_SECRET` as a previous key.

### 6.2 `KAST_SECRET_ENCRYPTION_KEY`

Encrypts `GlobalSetting` secret values, `WebhookEndpoint.secretHash`, and secret
fields inside `PluginConfig.data`. Rotation is supported and does not require
downtime or a re-entry of every credential.

```bash
# .env — move the current key into the previous list, then set a new one
KAST_SECRET_ENCRYPTION_KEY=$(openssl rand -base64 48)
KAST_SECRET_ENCRYPTION_PREVIOUS_KEYS=<the key you just replaced>
```

```bash
docker compose up -d --force-recreate api
```

Decryption tries the active key, then each previous key in turn. When a previous
key succeeds, the value is **re-encrypted with the active key and written back**
on that read. Rotation therefore completes lazily, as rows are used.

`KAST_SECRET_ENCRYPTION_PREVIOUS_KEYS` is comma-separated and accepts several keys,
so successive rotations can overlap. Keep an old key listed until you are satisfied
nothing still needs it; to force completion rather than wait for organic reads,
open each Settings tab, send a webhook test delivery per endpoint, and open each
plugin's config page. Then drop the old key from the list and recreate the API.

Verify before removing a previous key:

```sql
-- Any row still holding ciphertext is fine; you cannot tell which key it used
-- from SQL. Prove it by reading through the API, not the database.
SELECT key FROM "GlobalSetting" WHERE value LIKE 'enc:%';
```

### 6.3 Lost encryption key

There is no recovery. Ciphertext without the key is unrecoverable by design.
Re-enter every affected credential:

- Settings → Email → SMTP password
- Every webhook endpoint's signing secret (and update the receiver)
- Every plugin's configuration

Then rotate the underlying credentials themselves at their providers, because you
no longer know who else holds them.

### 6.4 Database and Redis passwords

```bash
# .env: POSTGRES_PASSWORD / REDIS_PASSWORD
docker compose exec postgres psql -U kast -c "ALTER USER kast WITH PASSWORD '<new>';"
docker compose up -d --force-recreate api admin redis
```

Redis's password is read from `.env` at container start; the recreate is what
applies it.

---

## 7. Disaster recovery

Assumes total loss of the host, with off-host copies of: the database dump, the
storage backup (or a versioned bucket), and `.env`.

1. **Provision** a host with Docker, and clone the repository at the tag that was
   running. `git log` the deployed image if you are unsure — restoring into a newer
   schema is fine, into an older one is not (§5).
2. **Restore `.env` first.** Without `KAST_SECRET_ENCRYPTION_KEY` the rest is a
   partial restore. Confirm the key is the one that matches the dump's vintage.
3. **Start data services only:** `docker compose up -d postgres redis`. Wait for
   both healthchecks.
4. **Restore the database** (§1.2), skipping the stop step — the API is not running.
5. **Restore object storage** (§2), or repoint `STORAGE_PROVIDER`/bucket variables
   at the surviving bucket.
6. **Start the application:** `docker compose up -d api admin`. Migrations apply
   on start.
7. **Verify, in this order:**
   - `curl -fsS localhost:3000/api/v1/health/ready` → all indicators up
   - `curl -fsS localhost:3000/api/v1/health/metrics` → Prometheus gauges scrape
   - Log into the admin
   - Open a media file → the object loads (proves storage)
   - Settings → Email → Send test email (proves the encryption key)
   - Delivery API returns a known published entry (proves content)
8. **Reconcile:** check for a backlog of `SCHEDULED` entries whose time passed
   during the outage — reconciliation publishes them within a minute of startup,
   which may be a burst of webhook traffic. Replay failed deliveries (§3) once
   receivers are reachable.
9. **Rotate** anything that may have been exposed by the incident itself (§6).

**Recovery objectives.** State them explicitly rather than inheriting them by
accident: RPO is your backup interval (§8), RTO is dominated by the restore of the
largest store — measure it in the drill rather than estimating it.

---

## 8. Drill schedule

A backup that has never been restored is a hypothesis.

| Interval                          | Exercise                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| Every deploy carrying a migration | Take a dump first (§5)                                                                 |
| Daily                             | Automated database dump; verify with `pg_restore --list`                               |
| Weekly                            | Storage backup (local provider only)                                                   |
| Quarterly                         | Full restore into a scratch environment (§1.2 + §2), timed — this is your measured RTO |
| Quarterly                         | Secret rotation with a previous key (§6.2), verified by a test email                   |
| Annually                          | Full DR from off-host copies onto a clean host (§7)                                    |

Record the measured restore duration each quarter. A number that grows is the
earliest signal that your recovery plan has quietly stopped fitting your data.

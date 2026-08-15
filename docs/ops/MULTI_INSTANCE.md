# Kast CMS — Running More Than One API Replica

What is safe at N>1, what must change first, and which behaviours become
eventually consistent. Read this before scaling the API past a single container.

The short version: **the API is horizontally scalable once you move media off
local disk and give the rate limiter shared storage.** Everything else either
already coordinates through Postgres/Redis or degrades in a bounded, documented
way.

---

## 1. Before you scale: two required changes

### 1.1 `STORAGE_PROVIDER` must not be `local`

`LocalStorageAdapter` writes to a container-local directory, and
`MediaFileController` serves it by resolving paths on that same filesystem. At
N>1 nothing about that works:

- An upload handled by replica A is a 404 on replica B.
- The `derive` job (WebP + thumbnails) is picked up by whichever replica is free.
  If that is not the replica that received the upload, the job fails to read the
  object and retries until it gives up.
- Permanent delete removes bytes only from the replica that runs the purge.

A shared network volume papers over the first and third but not reliably the
second, and it reintroduces a single point of failure. **Use `s3` or `r2`.**

```bash
STORAGE_PROVIDER=s3   # or r2
S3_BUCKET=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

Migrate existing local uploads to the bucket before cutting over — the keys in
`MediaFile.storageKey` are provider-independent, so a faithful copy of the
directory into the bucket root is sufficient.

### 1.2 The rate limiter counts per replica

`ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])` uses the default
in-memory storage. Each replica keeps its own counters, so with N replicas behind
a round-robin load balancer the effective global limit is **N × 100 per minute**,
and the login and password-reset limits scale the same way.

If your rate limits are a security control rather than a capacity guard — and for
the auth routes they are — give the throttler a Redis store before scaling, and
divide the configured limits by nothing: a shared store makes the configured
number the real number.

Until that change lands, treat the documented limits as per-replica and size them
accordingly.

---

## 2. Already safe at N>1

Verified against the current code; no configuration needed.

| Concern                              | Why it holds                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **MCP transport**                    | Streamable HTTP with no server-side session store. Any replica can serve any request; no sticky sessions.                            |
| **OAuth authorization codes**        | Stored in Redis with a TTL and consumed atomically, so the callback and the exchange can land on different replicas.                 |
| **Refresh tokens / sessions**        | Opaque hashes in Postgres. No in-process session state.                                                                              |
| **Scheduled-publish reconciliation** | `@Cron` fires on every replica, but the sweep runs behind a `pg_try_advisory_xact_lock`. One replica sweeps; the rest skip the tick. |
| **Daily trash purge**                | The cron only _enqueues_, with a deterministic `jobId` of `trash-purge-<date>`. BullMQ collapses the duplicates into one job.        |
| **First-owner setup**                | Guarded by a transaction-scoped advisory lock, so concurrent setup requests cannot both create a super-admin.                        |
| **Queue workers**                    | BullMQ distributes jobs across all connected workers by design. More replicas means more throughput.                                 |
| **Bull Board**                       | Authenticated by a signed cookie, validated per request against no local state.                                                      |

---

## 3. Eventually consistent — know the window

These converge without intervention. The point is that the window is non-zero and
you should not be surprised by it.

### Permission changes: up to 30 seconds

`PermissionResolverService` caches resolved role permissions in a per-process
`Map` with a 30-second TTL. Granting or revoking a permission calls
`invalidateRoles()`, which clears **only the replica that served the request**.

So after an administrator revokes `content: delete`:

- The replica that handled the save enforces it immediately.
- Every other replica keeps granting it for up to 30 seconds.

Acceptable for ordinary administration. Not acceptable as an incident response
step — if you are revoking access from a compromised account, **deactivate or
delete the user** (checked against the database on every request, no cache) rather
than editing the role, and then restart the replicas if you need certainty.

### Plugin enable/disable: until the next restart

`PluginLoader` reads `isActive` from the database once, during
`onApplicationBootstrap`. Toggling the switch writes a row; it does not unload
code from a running process.

At N>1 this means a disabled plugin keeps running on **every** replica until each
is restarted, and a newly enabled plugin starts running only after the same. Roll
the whole set, not one container.

Related: plugin event handlers are registered on an in-process `EventEmitter2`. An
event emitted while serving a request runs the handlers on that replica only —
which is what you want (one handler run per event), but it means plugin side
effects are attributed to whichever replica served the write, and a replica whose
plugin load failed silently stops contributing.

---

## 4. Capacity notes

**Worker concurrency multiplies.** Each replica runs the full processor set, so
the media processor's `concurrency: 2` becomes 2N concurrent Sharp encodes. Sizing
that ignores N will oversubscribe CPU on the shared host and, for the email and
webhook queues, can exceed a downstream provider's rate limit. There is no
worker-only mode: a replica that serves HTTP also processes jobs. Scale with that
coupling in mind, or run a dedicated replica pool that is not in the load
balancer's rotation.

**Database connections.** Prisma opens a pool per process. N replicas × pool size
must stay under Postgres `max_connections`, with headroom for migrations and
`psql`. Set `connection_limit` in `DATABASE_URL` explicitly rather than inheriting
the default once N > 2.

**Migrations run on every start.** The image's command is
`prisma migrate deploy && node dist/main.js`. Prisma takes an advisory lock, so
concurrent replica starts serialise safely — the first applies, the rest wait and
find nothing to do. Rolling deploys are fine; a simultaneous cold start of many
replicas just delays the last one.

---

## 5. Load balancer requirements

- **No sticky sessions required.** No request depends on hitting the replica that
  served the previous one.
- **Health check `/api/v1/health`** for liveness (database + Redis).
- **Health check `/api/v1/health/ready`** for readiness — it additionally probes
  storage and the workers, so a replica that cannot reach the bucket is taken out
  of rotation instead of serving broken media.
- **Set `TRUST_PROXY`** to match your topology. It decides what `req.ip` means,
  which is both the address recorded against public form submissions and the key
  the rate limiter counts. Left unset behind a proxy, every request appears to come
  from the load balancer and the per-IP limits become global.
- **`CORS_ORIGINS` must be explicit.** Wildcard is rejected in production.

---

## 6. Checklist

```
[ ] STORAGE_PROVIDER is s3 or r2, and existing uploads are migrated
[ ] Throttler backed by shared storage, or limits sized per replica knowingly
[ ] TRUST_PROXY matches the proxy chain
[ ] CORS_ORIGINS lists real origins
[ ] DATABASE_URL sets connection_limit; N × limit < max_connections
[ ] Load balancer probes /api/v1/health/ready
[ ] Deploy process restarts all replicas together after a plugin toggle
[ ] Runbooks reviewed for the N>1 case (docs/ops/RUNBOOKS.md)
```

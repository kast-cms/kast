# Kast CMS — Open Findings Register

**Commit audited:** `d0e707b` on `fix/close-remaining-gaps`, i.e. `b3b1669` (merge of PR #66) plus the media/reconciliation fixes and operations runbooks in this branch.
**Date:** 2026-08-15
**Supersedes:** the 2026-08-12 revision of this file, which was written against `40ef66f` and predates PR #66. It described 78 open entries, the large majority of which that PR closed.
**Point-in-time audit record:** `docs/KAST_FULL_GAP_ANALYSIS_2026-08-10.md` (unchanged; historical).

## Bottom line

The register has inverted. The previous revision listed 78 entries of remaining
work and said the gap between "P0 blockers closed" and "shippable" was the whole
of MCP and plugins plus a dozen unlabelled security items. PR #66 closed almost
all of it, including both subsystems it named as structural: **MCP now speaks
Streamable HTTP through the official SDK and has a conformance test against a real
client; plugins load behind `isActive`, ship in the production image, and can
register storage, email and error-reporting extensions.** The dozen security items
— plugin config encryption, the redactor's key set, a permission matrix that could
not revoke, scoped tokens ignoring the content-type dimension, MCP accepting JWTs,
`gcs` silently writing to ephemeral disk, an open Redis, unaudited denials — are
closed with enforcement you can point at.

What is left is **eight entries, five of which are product decisions rather than
defects.** Nothing on the list is a security boundary failure, a data-loss path, or
an advertised feature that silently does nothing. The largest remaining items are
the two deliberate architectural commitments the previous register flagged as
"decide, then build": whether plugins get a real isolation boundary and a real
installer, and whether the MCP agent-session model should describe a connection
rather than a call.

The honest summary of the release posture: the security and data-integrity spine is
done and tested. What remains is scope and depth — how far the plugin platform goes,
how deep the scaffolder's tests go, and a documentation-hygiene tail.

## Coverage

Re-verified entry by entry against the source at `d0e707b`.

|                                                   |  Count |
| ------------------------------------------------- | -----: |
| Entries carried from the 2026-08-12 register      |     78 |
| **Closed** (verified against enforcing code)      | **68** |
| **Partial** (core closed, named path uncovered)   |  **2** |
| **Open**                                          |  **6** |
| Of the open/partial, requiring a product decision |      5 |

**Verification standard.** Each entry was checked by reading the code that would
have to enforce it, not by re-running the original probe. Behavioural claims about
restore, failover and multi-replica timing in `docs/ops/` are reasoned from the
code and configuration and have not been exercised against a production-sized
deployment — the runbook says so at the top, and the drill schedule exists to fix
that.

Three corrections to my own earlier reporting, made during this pass:

- **`SEC-15` and `SEC-18` were reported open in conversation and are not.** The
  pre-trash flag exists as `User.preTrashIsActive`, and the public media route
  filters trashed rows inside `MediaRepository.findActiveByStorageKey` rather than
  in the controller. Both were missed by grepping for the wrong identifier.
- **`AUD-02` is closed, in a place the original evidence did not look.** Guard
  rejections never reach the audit interceptor — interceptors run after guards —
  so the fix lives in `GlobalExceptionFilter`, which writes `request.denied` for
  every 401/403 and `request.failed` for failed mutations.
- **`ADV-01` is closed by a different mechanism than the one proposed.** The
  suggested fix was to surface `enforcedBy` in the admin so the UI would stop
  claiming that saved SMTP settings are used. Instead `EmailProcessor.deliver`
  now routes through `SettingsService.sendEmail`, so the saved settings genuinely
  are used and the UI copy became true. `enforcedBy` is still unrendered, which no
  longer misleads.

---

## 1. Open — product or architecture decision required

These are not defects with an obvious correct fix. Each needs a call on scope
before any code is worth writing.

| ID          | Gap                                                                          | Sev    | Effort | Migration |
| ----------- | ---------------------------------------------------------------------------- | ------ | ------ | --------- |
| **PLG-D**   | Install only inserts a database row — nothing is fetched, verified or placed | High   | L      | **Yes**   |
| **SEC-23a** | Manifest permissions are a startup string check, not a sandbox               | High   | L      | No        |
| **PLG-G**   | Manifest `adminPages` render as links; no packaged plugin UI is mounted      | Medium | L      | No        |
| **MCP-L**   | `AgentSession` is one row per tool call, not a connection session            | Medium | M      | **Yes**   |
| **MCP-C**   | Eight PRD tool capabilities are absent; the PRD was aligned to the code      | Medium | L      | No        |

**PLG-D.** `PluginService.install` writes a row and nothing else: no npm install,
no artifact download, no signature or integrity check, no copy onto disk. Plugins
work only if their code is already on the filesystem at build time. This is
internally consistent today — the loader scans `/plugins`, the image copies it, and
first-party plugins ship in the tree — but it means the admin's Install button
describes something the system cannot do for a plugin it does not already have.
**Decision:** either build real artifact installation (registry, verification,
placement, and a restart contract), or rename the operation to match what it does
and document plugins as build-time extensions.

**SEC-23a.** The boot-crash half is fixed: `ALLOWED_PERMISSIONS` now includes
`settings:write` so a permission the published SDK enum offers can no longer take
the API down, and each plugin loads inside its own try/catch. The sandbox half is
untouched by design — plugins are `require()`d into the API process with full Node
capability, so a plugin declaring `content:read` can still read `process.env`, the
filesystem and the network. The permission list is documentation, not enforcement.
**Decision:** real isolation is a worker-thread or subprocess architecture and a
serialised context API — a large commitment. The alternative is to say plainly in
the plugin docs that plugins are trusted code, and stop implying otherwise.

**PLG-G.** `adminPages` from the manifest are rendered as navigation entries by
`plugins-page.tsx`; the pages themselves are hand-written core screens. A plugin
cannot ship its own UI. **Decision:** module federation or an iframe contract, both
substantial; or drop `adminPages` from the manifest schema.

**MCP-L.** `AgentTokenRepository.logToolCall` writes one `AgentSession` row per tool
call with a zero duration span. Attribution is now correct — `agentTokenId`,
`agentName`, outcome and `durationMs` are all recorded, which is what made denials
auditable — but "session" in the schema still means "call". **Decision:** either
model a real connection lifecycle (open on transport connect, close on disconnect,
with calls as children) — which needs a schema change — or rename the model to
`AgentToolCall` and keep the flat shape.

**MCP-C.** Fifteen tools are registered, and code, the admin scope selector and the
docs site now all agree on the same fifteen names — the PRD was updated to match
rather than the reverse. Eight capabilities the PRD previously required remain
unimplemented: unpublish, add-field, three plugin control tools, media upload,
redirect create, and user create. `ContentService.unpublish` exists and is simply
not exposed. **Decision:** this is now a scope question, not drift. Add the tools,
or state that the MCP surface is deliberately read-heavy with a narrow write set.

---

## 2. Open — no decision needed

| ID         | Gap                                                                        | Sev    | Effort |
| ---------- | -------------------------------------------------------------------------- | ------ | ------ |
| **CLI-H**  | CLI tests are filesystem-shallow — no install, build, migrate, boot, login | Medium | L      |
| **OPS-12** | One 902-line migration, misleadingly named `add_password_reset_token`      | Medium | L      |
| **POL-10** | 58 unchecked Definition-of-Done and security-checklist boxes               | Low    | M      |

**CLI-H** is the one with real value. The eight scaffold tests assert file presence
and string content; none installs dependencies, generates Prisma, builds, migrates,
boots, or logs in. `CLI-A` — MinIO offered by the CLI and rejected by the API env
schema, so the generated project crashed on first `pnpm dev` — is exactly the class
of defect this catches, and it shipped. The Docker smoke test added in CI is the
model to follow: generate a project into a temp dir, frozen install, build, start
Postgres and Redis, migrate, boot, create the first owner, publish one entry,
fetch it through delivery. Slow, so gate it to a nightly or a label.

**OPS-12.** A second migration now exists, but the initial one still creates all 38
models under a name describing a password-reset column. Splitting it retroactively
means rewriting applied migration history, which every existing deployment has
recorded — so this is a "next major, with a documented reset" item, not a routine
fix. Its practical cost today is that migration intent is unreadable and there is
no exercised incremental upgrade history.

**POL-10** is planning-document hygiene: the phase Definitions of Done and the
security checklist are unchecked even where the code exists, so they cannot be read
as status. Checking them honestly means re-verifying each line, which is the work —
not the ticking.

`POL-08` and `POL-15` were carried as open and are not. The admin's typecheck script
is `next typegen && tsc --noEmit`, so CI does generate route types. The remaining
`kastcms.com` strings are example email addresses in the API spec plus one line in
`KAST_VISION.md` offering `kastcms.com` **or** `kast.dev` as the marketing domain —
an undecided branding question, not a documentation defect. Every docs URL resolves
to `docs.kast.dev`.

---

## 3. Partial

| ID         | Gap                                                | What closed                                                                                                                                                                               | What remains                                                                        |
| ---------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **SEC-23** | Plugin permission model                            | The boot crash: the SDK enum and `ALLOWED_PERMISSIONS` agree, and each plugin loads in its own try/catch, so one malformed manifest can no longer take the API down                       | The sandbox — tracked as `SEC-23a` above                                            |
| **OPS-08** | Dead-letter, replay, idempotency, backlog alerting | Failed jobs are retained and replayable through `POST /queue-operations/:name/replay-failed`; jobs carry deterministic ids and the publish path is conditional, so replays are idempotent | No backlog-depth alerting. `/health/ready` reports worker liveness, not queue depth |

---

## 4. Closed since the last register

Recorded so the next reader can trust the list above rather than re-deriving it.
Each was verified against the code that enforces it.

**Secrets (3/3).** `SEC-01` plugin config now encrypts through
`SecretEncryptionService`. `SEC-02` the redactor applies `isSecretSettingKey` to an
object's own keys and covers `apiKey`/`accessKey`/`clientSecret`/`passphrase`.
`SEC-03` webhook secrets use `KAST_SECRET_ENCRYPTION_KEY`, with
`KAST_SECRET_ENCRYPTION_PREVIOUS_KEYS` and lazy re-encryption on read giving a real
rotation path (documented in `docs/ops/RUNBOOKS.md` §5.2).

**Authorization (7/7).** `SEC-04` `assignPermissions` calls `replacePermissions`, so
unchecking revokes. `SEC-05` `scopeDataAllows` consults `target.scopeValue`, so a
scoped token is bounded by content type. `SEC-06` MCP requires an agent token —
`hasAgentScope` denies any non-agent principal. `SEC-07` a permission catalog exists
and `role.dto.ts` validates against it with `@IsIn`. `SEC-08` `RolesGuard` returns
false on undecorated routes. `SEC-09` the admin token dialog ships `scopeData`.
`SEC-10` OAuth linking rejects an unverified email before returning an existing user.

**Data loss (8/8).** `SEC-11` `gcs` removed from the storage enum, and provider
credentials are required per provider. `SEC-12` Redis runs with `--appendonly yes`
and `--requirepass`, port unpublished. `SEC-13` `PublishReconciliationService`
sweeps due entries every minute. `SEC-14` media purge raises `ServiceUnavailable`
rather than deleting a row whose bytes it could not remove. `SEC-15`
`User.preTrashIsActive` preserves the pre-trash state across a restore. `SEC-16`
the Stripe signature is length-guarded before `timingSafeEqual`. `SEC-17` S3 and R2
force `ContentDisposition: attachment` for SVG. `SEC-18` the public media route
resolves only non-trashed rows.

**Anonymous surface (3/3).** `SEC-19` delivery menus are projected and filtered by
`isActive`. `SEC-20` relations resolve rather than leaking raw ids. `SEC-21`
`ContentType.isPubliclyDiscoverable` defaults to false, so schema discovery is opt-in.

**MCP (14 of 16).** `MCP-A` Streamable HTTP via `@modelcontextprotocol/server`, with
`MCP-F` a conformance test driving a real `@modelcontextprotocol/client`. `MCP-B`
arguments validate against `inputSchema` through the SDK's Ajv validator. `MCP-D`
and `MCP-E` every attempt — success, failure and denial — is audited with
`agentTokenId`, `agentName`, outcome and `durationMs`. `MCP-G` the publish dry run
calls `previewPublish`, which runs the real gate, so the preview can no longer
report a success the real call would refuse. `MCP-H` agent scopes validate against
`MCP_TOOL_NAMES`. `MCP-I` `tools/list` is scope-filtered. `MCP-J` MCP defers to
`PermissionResolverService`, so custom roles apply. `MCP-K` denials return
`SCOPE_DENIED` and record latency. `MCP-M` the in-memory session store is gone.
`MCP-N`/`MCP-O` ping, heartbeat and version negotiation come from the official SDK.
`MCP-P` the PRD no longer lists the `kast_*` names.

**Plugins (6 of 8).** `PLG-A` the runner image copies `/app/plugins`. `PLG-B` the
loader reads `isActive` and skips disabled plugins. `PLG-C` uninstall clears
`isInstalled` instead of deleting the row, so nothing resurrects enabled.
`PLG-E` `PluginExtensionRegistry` accepts storage, email-transport and
error-reporter registrations. `PLG-F` `@sentry/node` is a direct API dependency.
`PLG-H` `plugin.loader.spec.ts` covers the control plane.

**Advertised-but-inert (15/15).** `ADV-01` queued mail is sent through the saved
SMTP settings. `ADV-02` a public delivery redirects endpoint exists. `ADV-03` media
detail includes `usages`, and `ContentRelation`/`MediaUsage` rows are written by
`content-reference.repository.ts`. `ADV-05`/`ADV-06` `isPublic` is settable and the
seed and admin share the `site.name` namespace. `ADV-07` multipart upload honours
`folderId`. `ADV-08` `caption` exists on the schema. `ADV-09` `user.created` is
emitted. `ADV-10` `media.deleted` is a real event. `ADV-11` webhook deliveries
paginate by cursor. `ADV-12` version retention is enforced. `ADV-13` thumbnail URLs
are carried on the media view. `ADV-15` the unused AI tables are gone. **`ADV-14`
closed in this branch**: optimize and thumbnailing became one sequential `derive`
job, so the uploaded original is reclaimed once its derivatives are durable
instead of lingering unreferenced and uncounted.

**Scaffolder (7 of 8).** `CLI-A` MinIO removed. `CLI-B` `/api/v1/mcp` corrected
everywhere. `CLI-C` selected plugins are copied into the project. `CLI-D` the blog
and docs starters are scaffolded from the template. `CLI-E` locale selection drives
`KAST_DEFAULT_LOCALE`/`KAST_INITIAL_LOCALES`, which the seed reads. `CLI-F`
`setup.sh` deleted. `CLI-G` parity now byte-compares ten trees and the synced
top-level files, with a `sync:template` script.

**Operations (14 of 16).** `OPS-01` `/health/ready` probes Redis, storage and
workers. `OPS-03` compose has an admin service. `OPS-04` no fixed default database
password. `OPS-05` the image migrates on start. `OPS-06` audit writes are awaited
inside the interceptor's `concatMap`, not fire-and-forget. `OPS-07` the producerless
`kast.audit` queue is gone. `OPS-09` Bull Board authenticates by cookie, not a
query-string token. `OPS-10` OAuth codes live in Redis with a TTL. `OPS-13` storage
credentials are required per selected provider. `OPS-14` wildcard CORS is rejected
in production. `OPS-15` `pnpm audit --prod --audit-level=moderate` passes clean.
`OPS-16` the `User` authoring relations are `onDelete: SetNull`, so an authoring
user can be purged. **`OPS-02` and `OPS-11` closed in this branch**:
`docs/ops/RUNBOOKS.md` covers backup, restore, migration rollback, secret rotation
and disaster recovery; `docs/ops/MULTI_INSTANCE.md` states what is safe at N>1,
the two changes required first, and the convergence windows. The scheduled-publish
sweep also took an advisory lock so it no longer runs on every replica at once.

**Audit logging (4/4).** `AUD-01` `before` is the persisted prior row, captured
before the handler runs. `AUD-02` `GlobalExceptionFilter` writes `request.denied`
for 401/403 and `request.failed` for failed mutations, which is the only place that
can see a guard rejection. `AUD-03` `@AuditAction` is applied across the content
controller and `TRAILING_ACTIONS` names publish, unpublish, restore, reorder and the
rest. `AUD-04` `after` is re-read from the database, not the serialized response.

**Correctness and polish (13 of 16).** `POL-01` version revert normalizes slugs
through `requireSlug`. `POL-02` webhook payloads carry `version: '1'`. `POL-03` the
API spec documents the routes the API serves. `POL-04` the forms docs use the real
request and response shapes. `POL-05` bcrypt is gone from every document, including
the public disclosure page. `POL-06` the SEO docs name real routes. `POL-07` the
README describes the right apps. `POL-09` the Astro site has a `site` value.
`POL-11` the README banner matches the released version. `POL-12` `typedRoutes` is
top-level and the admin uses `proxy.ts`. `POL-13` SDK `exports` orders `types`
first. `POL-14` Prisma is configured by `prisma.config.ts`. `POL-16`
`.claude/settings.local.json` is prettier-ignored.

---

## What I would do next

1. **`CLI-H`** — the only remaining item that would have caught a shipped defect.
   Build the generate-install-boot test on the pattern the Docker smoke test
   established, and gate it to nightly so PR latency does not suffer.
2. **Decide the plugin question** (`PLG-D`, `SEC-23a`, `PLG-G` are one decision in
   three parts). The system is currently a coherent build-time extension mechanism
   whose admin UI implies a runtime one. Either close that gap or change the copy —
   the present state is the only place left in the product where the interface
   promises more than the runtime does.
3. **Decide `MCP-C` and `MCP-L` together.** Both are "what is the MCP surface
   meant to be" questions, and `MCP-L` carries a migration, so it is cheaper to
   answer once.
4. **`OPS-12`** at the next major, with a documented migration reset.
5. **The `POL` tail** in one housekeeping pass.

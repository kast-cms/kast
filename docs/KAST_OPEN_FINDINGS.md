# Kast CMS — Open Findings Register

**Commit audited:** the head of `fix/close-remaining-gaps` — `b3b1669` (merge of PR #66) plus this branch's reconciliation lock, operations runbooks, plugin honesty pass, MCP tools and scaffold boot test.
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

That left eight entries, five of them product decisions rather than defects. All
five were decided on 2026-08-15 and acted on — §1 records the reasoning. **Two
entries remain open**, both housekeeping: the initial migration's name, and the
unchecked boxes in the phase plans.

Four live defects surfaced while acting on those decisions, none of them on any
list. **The MCP server registered no tools at all** — the registry read decorator
metadata from the wrong slot, so `tools/list` was empty and no call could be
dispatched, and the conformance test missed it by stubbing the registry. The other
three were all in freshly generated projects, which **did not compile** (the repo's
lockfile pins a BullMQ old enough to still expose the Redis commands the code
calls), **wrote build permissions where the pinned pnpm does not read them**, and
**could not load sharp on pnpm 9**. All four are fixed, and each has a test that
would catch the recurrence.

The honest summary of the release posture: the security and data-integrity spine is
done and tested, and the two subsystems the last register called structural gaps —
MCP and plugins — are now either working or honestly described. What remains is a
documentation tail and whatever the nightly scaffold run turns up next.

## Coverage

Re-verified entry by entry against the branch head.

|                                                   |  Count |
| ------------------------------------------------- | -----: |
| Entries carried from the 2026-08-12 register      |     78 |
| **Closed** (verified against enforcing code)      | **74** |
| **Accepted** (decided, documented, not built)     |  **2** |
| **Open**                                          |  **2** |
| Defects found while closing them, not on any list |      4 |

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

## 1. Decisions taken

The five entries that needed a product call were decided on 2026-08-15 and acted
on in the same branch. Recorded here because the reasoning is the finding — the
code that followed is small.

### Plugins are a trusted, build-time extension mechanism (`PLG-D`, `SEC-23a`, `PLG-G`)

**Decision: document what the system is, rather than build what the UI implied.**
Real artifact installation, process isolation and plugin-supplied UI are each a
multi-week commitment, and nothing in the product needs them before there is
third-party demand.

What changed:

- `install`/`uninstall` became `register`/`deregister` across the route, DTO,
  service, loader, SDK and admin. The operation records a plugin already present
  in the deployment's `plugins/` directory; it fetches nothing and verifies
  nothing, and the descriptions now say so.
- `KAST_SECURITY_MODEL.md` §6 said "plugins are sandboxed … they only receive the
  data and capabilities they declared". It now says the opposite, because the
  opposite is true: plugins run in-process with full Node capability, and the
  manifest permissions are a compatibility check. The section also states what
  _is_ bounded — a failing plugin is skipped, a throwing hook handler is caught.
- The plugin docs gained a trust model, the three real lifecycle states (bundled,
  registered, enabled), and a note that `adminPages` links a built-in
  configuration screen rather than mounting plugin-supplied UI.

**Still true, and now stated rather than implied:** a plugin is inside every trust
boundary the security model describes. Revisit isolation when third-party plugins
become a real distribution channel.

### MCP gets the missing tools; the session model is renamed, not rebuilt (`MCP-C`, `MCP-L`)

**Decision: add the eight absent capabilities, and rename `AgentSession` to
`AgentToolCall` instead of modelling a connection lifecycle.** The transport is
stateless Streamable HTTP, so there is no connection to model — the table was
always one row per invocation, and the honest fix is the name.

The tool count went from 15 to 23: `unpublish_content_entry`,
`add_content_type_field`, `upload_media_from_url`, `create_redirect`,
`list_plugins`, `enable_plugin`, `disable_plugin`, `invite_user`. Every mutating
one has a dry run that runs the real checks rather than asserting success — the
invite preview runs the escalation and duplicate checks, the redirect preview runs
the open-redirect policy, and the upload preview resolves the URL through the SSRF
guard without transferring a body. There is no create-user-with-password path in
Kast, so the user tool invites.

**Found while doing it — the whole tool surface was dead.** `McpRegistry` read tool
metadata from `(prototype, methodName)`. Nest's `@SetMetadata` on a method writes to
`descriptor.value`, the function itself, so that lookup returned `undefined` for
every method and the registry registered nothing: an empty `tools/list` and no
dispatchable call. `MCP-F`'s conformance test did not catch it because it stubs
`McpRegistry` and injects a hand-built tool, leaving the decorator path with no
coverage at all. Fixed, and `mcp-tool-catalog.spec.ts` now fails if the allow-list
and the registry ever disagree again.

### The scaffolder gets a real boot test (`CLI-H`)

**Decision: build it, nightly-gated.** `packages/create-kast-app/test/scaffold-boot.sh`
generates a project and runs it: install, Prisma generate, migrate, build, boot,
create the first owner, model a content type, publish an entry, read it back
through the anonymous delivery API, and confirm the management API still answers 401. `.github/workflows/nightly-scaffold.yml` runs it on a schedule, on demand, and
on PRs that touch the scaffolder or its template.

**It found three shipped defects before it went green once**, every one invisible
to the rest of the suite because each needs a real install of a real generated
project on the platform a user is actually on.

_Build permissions were written where the pinned pnpm does not read them._ The
location has moved twice: package.json `pnpm.onlyBuiltDependencies` below pnpm 10,
`onlyBuiltDependencies` in `pnpm-workspace.yaml` at 10, and an `allowBuilds` map at
11 — which additionally **fails the install** when a dependency with a build script
is listed neither way. The scaffolder always wrote the package.json form, so a
project generated on pnpm 10 silently skipped the build scripts for `argon2`,
`sharp` and Prisma (a clean-looking install, then a runtime failure on missing
native bindings), and one generated on pnpm 11 could not install at all. The
generated config now matches the version `packageManager` pins.

_The generated project did not compile._ `apps/api` depends on `bullmq: ^5.39.0`.
The repo's lockfile pins 5.76.1; a fresh install resolves 5.81.3, and between those
releases BullMQ narrowed `IRedisClient` — `ping` and `eval` are no longer on it.
The health check and the ephemeral-state helpers call both, so `nest build` failed
with ten errors in any newly generated project while the monorepo stayed green on
its lockfile. The commands we rely on are now declared in `queue/redis-commands.ts`
and asserted in one place, so a future narrowing is a compile error there rather
than a surprise for the next person to run `create-kast-app`.

_sharp could not load libvips on pnpm 9._ The generated project installed and built
cleanly and then died on its first boot with `ERR_DLOPEN_FAILED`. pnpm 9 does not
link a package's optional dependencies into a peer-suffixed instance; sharp lands
in one via `@types/node`, resolves its platform binding by walking up to the
workspace root, and then cannot find the libvips shared object that should sit
beside it. Every `@img/*` package is present in the store — a linking bug, not a
missing download — and the install exits 0, so nothing before first boot notices.
Reproduced in a `linux/amd64` container across majors (9 broken, 10 and 11 fine),
so projects pinned below pnpm 10 now get `node-linker=hoisted` and later ones keep
the strict layout.

Worth recording how that one was diagnosed, because the first attempt was a guess:
`auto-install-peers` looked like a plausible cause, shipped, and failed in exactly
the same place. The container matrix took one run to answer what two CI round-trips
had not.

Together these are the argument for this test in one paragraph. A monorepo is
structurally immune to most of what its own users hit on day one — a lockfile hides
dependency drift, a committed `.npmrc` hides configuration gaps, and the maintainer's
package-manager version hides everything version-specific. Only generating a project
and running it exercises the path a user takes.

---

## 2. Still open

| ID         | Gap                                                                   | Sev    | Effort |
| ---------- | --------------------------------------------------------------------- | ------ | ------ |
| **OPS-12** | One 902-line migration, misleadingly named `add_password_reset_token` | Medium | L      |
| **POL-10** | 58 unchecked Definition-of-Done and security-checklist boxes          | Low    | M      |

**OPS-12.** Two more migrations now exist, but the initial one still creates all 38
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
was already closed**, by the other option the gap analysis offered: the original is
deliberately retained and tracked. `MediaFile` carries `originalStorageKey`,
`originalUrl` and `originalSize`, and `toView` reports `totalSize` as original +
optimized + thumbnails, so the footprint is accounted for rather than undercounted.
Purge reclaims all of it. An attempt in this branch to delete the original after
the WebP landed was reverted: it would have left `originalUrl` pointing at bytes
that no longer existed.

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

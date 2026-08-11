# Kast CMS — Open Findings Register

**Commit audited:** `40ef66f` (merge of PR #63, the gap-analysis remediation). Working tree also contains `bed168e`, a docs-only commit touching `README.md`, `KAST_VISION.md` and a new ADR — it changes no row below.
**Date:** 2026-08-12
**Supersedes for open-item tracking:** `docs/KAST_FULL_GAP_ANALYSIS_2026-08-10.md` (which remains the point-in-time audit record).

## Bottom line

The remediation did what it claimed on the P0 blockers, and did it properly. Five of the nine are closed with enforcement you can point at — the known super-admin credential, schema validation of entry data, webhook SSRF, agent-token containment, and entry-to-type binding. Four are closed in their core but leak at an edge the fix did not reach: the anonymous surface is shut except the delivery _menus_ route, scoped API tokens are enforced except along the content-type dimension, custom RBAC grants work but revocation through the UI silently does nothing, and settings secrets are encrypted while _plugin_ secrets are not. Section 8's P1 rows came out well: forms, trash, SEO, most of media and the entire settings-honesty problem are genuinely fixed, and CI now runs the API e2e suite against a real ephemeral database. Dependency advisories are down to three, all Astro in `apps/docs`, none reachable from the API or admin.

What you are left holding is not a pile of missed P0s. It is three things. First, a short list of real security and data-loss exposures the remediation was never scoped to touch — plugin credentials stored and logged in cleartext, an admin permission matrix that cannot revoke, `STORAGE_PROVIDER=gcs` silently writing uploads to ephemeral container disk, Redis running without AOF or a password on a published port, and audit logging that records neither the prior state nor any denied attempt. Second, and larger in volume: the two subsystems the product's positioning rests on — **MCP** and **plugins** — do not work as advertised, and were explicitly out of scope. The MCP SSE handshake never emits the `endpoint` event a client waits for, so the documented Claude Desktop integration cannot connect at all; the plugin loader ignores `isActive`, uninstall resurrects the plugin as _enabled_ on next boot, and the production image contains no plugins directory. Third, ordinary drift: docs that 404, a scaffolder that offers a storage provider the API rejects, and untested modules.

None of this is catastrophic and none of it is hidden — the code is honest about most of it in comments. But the gap between "P0 blockers closed" and "shippable" is still the whole of sections 9 and 10, and about a dozen security items that never had a P0 label.

## Coverage

|                                                 |   Count |
| ----------------------------------------------- | ------: |
| Findings assessed across all sections           |     200 |
| **Fixed** (verified against enforcing code)     |  **63** |
| **Partial** (core closed, named path uncovered) |  **31** |
| **Open** (reported behaviour still holds)       | **105** |
| Report was wrong / overtaken by events          |       1 |

Of the 136 rows carrying remaining work, this register consolidates them into **78 entries** after merging duplicates reported from different angles.

**Verification standard.** Every entry below was re-read against the source at `40ef66f` before inclusion. Where an auditor's evidence was thin or overstated, the entry says so. Corrections made during this pass:

- **`PLUG-02b` — the original report was wrong.** It claimed the bootstrap upsert resets `isActive` to `true` on an existing row. It does not: `plugin.repository.ts:49` sets `isActive: true` only in the `create` branch; the `update` branch (`:51-55`) leaves it alone. The real consequence is _worse_ than reported — the row correctly stays `isActive: false` while the plugin's code loads and runs anyway, so the admin console actively misreports the running state. Folded into `PLUG-02`.
- **`PLUG-06`** stated `PATCH /plugins/:name/config` is open to ADMIN. It is `@Roles(SUPER_ADMIN)` (`plugin.controller.ts:70`). `GET` is ADMIN+SUPER_ADMIN (`:63`), which is where the read exposure actually is. Corrected in `SEC-01`.
- **`10.2-STRIPE-hmac`** implied the 500 is reachable on any instance. It is not: the handler returns 503 unless `STRIPE_WEBHOOK_SECRET` is set (`stripe.controller.ts:43-48`), and a replay guard rejects stale timestamps first. It is reachable on any _Stripe-configured_ instance with a current timestamp — still a real unauthenticated log-flood primitive, but scoped. Corrected in `SEC-16`.

---

## 1. Security and data-loss risk

These are ordered by exposure, not by section. The first six are the ones I would not ship without.

### 1.1 Secrets

| ID         | Gap                                                                               | Sev    | Effort | Decision | Migration |
| ---------- | --------------------------------------------------------------------------------- | ------ | ------ | -------- | --------- |
| **SEC-01** | `PluginConfig.data` is plaintext jsonb, returned in full to any ADMIN             | High   | M      | No       | No        |
| **SEC-02** | Audit redactor's key set misses `apiKey`/`accessKey`/`clientSecret`/`passphrase`  | Medium | S      | No       | No        |
| **SEC-03** | Webhook secrets encrypted with `JWT_SECRET`; `KAST_SECRET_ENCRYPTION_KEY` ignored | High   | M      | Yes      | No        |

**SEC-01** (was `P0-06a`, `PLUG-06`). `plugin.repository.ts:102-113` upserts the caller's object straight into the jsonb column — no encryption, no secret-key detection. `:94-100` returns `cfg.data` verbatim, `plugin.service.ts:50-62` passes both through untouched and echoes the stored config back in the `PATCH` response. `grep -rn "encryptSecret\|isSecretSettingKey" apps/api/src` has no hit anywhere under `modules/plugin`. The settings path was hardened against exactly this; the plugin path was not, even though the report's acceptance criterion named both. A Stripe secret key or S3 access key typed into plugin config sits in cleartext in every database backup and is readable by any ADMIN via `GET /api/v1/plugins/:name/config`. Today no first-party plugin writes a secret there — they write bucket/host metadata — so this is latent rather than actively leaking, which is the only reason it is not the top row.

**SEC-02** (was `P0-06b`). `redact.util.ts:7-18` is an exact-match set of ten literal keys. `redactObject` (`:51-59`) applies `isSecretSettingKey`, but only through `isSecretKeyValuePair` — that is, only to the `{ key, value }` shape the settings PATCH body uses. A plain object whose _own key_ is the credential name is not covered, and `SENSITIVE_KEYS` does not contain `apikey`, `clientsecret`, `accesskey` or `passphrase`, even though `isSecretSettingKey` already matches all of them. Confirmed empirically against the compiled utility:

````
redactSensitive({settings:[{key:'smtp.password',value:'hunter2'}]})
  -> {"settings":[{"key":"smtp.password","value":"***REDACTED***"}]}   // covered
redactSensitive({apiKey:'sk-live-XXXX', clientSecret:'cs_XXXX'})
  -> {"apiKey":"sk-live-XXXX","clientSecret":"cs_XXXX"}                 // NOT covered
``` `AuditInterceptor` logs every mutating request's body and response (`:56,68`), so `PATCH /plugins/:name/config` with `{"apiKey":"sk-live-..."}` writes that value into `AuditLog.changes` **twice** — once as `before` from the request body, once as `after` because `updateConfig` echoes it back. The audit log is permanent, admin-readable and CSV-exportable, which makes this the widest of the plugin-secret exposures and the cheapest to fix.

**SEC-03** (was `8.7-secret-encryption-key`, `13.2-d`). `webhook.service.ts:34` and `webhook.processor.ts:87` both do `config.get('JWT_SECRET') ?? 'kast-dev-secret'`. A dedicated key exists (`env.schema.ts:33`) and is honoured only by the settings module. Rotating `JWT_SECRET` after a token leak — a routine incident response — makes every stored webhook secret undecryptable at once, and every receiver's HMAC verification fails simultaneously. There is no escape: an operator who set `KAST_SECRET_ENCRYPTION_KEY` correctly still has webhooks bound to the JWT key. Note also the hardcoded `'kast-dev-secret'` fallback in both files. Generated projects now get two independent 48-byte secrets (`scaffold.ts:37-42`), so the worst case is closed for scaffolded installs; hand-configured deployments still couple the two. **Decision needed:** whether to migrate existing ciphertext on key change or force re-entry of webhook secrets.

### 1.2 Authorization

| ID | Gap | Sev | Effort | Decision | Migration |
|---|---|---|---|---|---|
| **SEC-04** | Unchecking a permission in the admin matrix never revokes it | High | S | No | No |
| **SEC-05** | SCOPED API tokens ignore the content-type dimension | High | M | Yes | No |
| **SEC-06** | MCP transport accepts JWTs and FULL_ACCESS tokens with no scope check | High | S | Yes | No |
| **SEC-07** | No canonical permission seed; matrix expresses 5 of ~20 derivable actions | High | M | Yes | No |
| **SEC-08** | Undecorated routes are open to any system-role holder, including viewer | Medium | M | Yes | No |
| **SEC-09** | Admin offers a SCOPED token option the API always rejects with 400 | Medium | S | No | No |
| **SEC-10** | OAuth account *linking* skips the verified-email gate | Medium | S | Yes | No |

**SEC-04** (was `P0-04a`) is the one that fails in the unsafe direction and costs almost nothing to fix. `permission-matrix.tsx:60-70` `matrixToBody` emits only entries where `enabled` is true and discards the false ones; `use-roles.tsx:104-115` calls only `assignPermissions`; `roles.service.ts:158-178` loops `repo.addPermission` and never deletes. The revoke endpoint exists (`roles.controller.ts:83`) and the admin never calls it. An administrator who unchecks `content: delete`, saves, and sees the box stay unchecked has changed nothing — the `RolePermission` row survives and the resolver keeps granting. Reload restores the checked box, so it is discoverable, but the window between save and reload is a silent false negative on a security control. This is precisely the impact the original report described for P0-04, on the half the remediation did not touch.

**SEC-05** (was `P0-02`). Enforcement is real and well built — `token-policy.guard.ts:57-84` fails closed on unresolvable routes and on `undefined` scope. But `scopeDataAllows` (`:86-94`) reads only `scopeData[target.resource] ?? scopeData['*']` and **never consults `target.scopeValue`**, which `route-permission.util.ts:87-95` computes from the `typeSlug` route param specifically for this purpose. I confirmed the only references to `scopeValue` outside spec files are its own definition and construction. The report's acceptance criterion was "a scoped content token cannot access users, settings, plugins, *or another content type*" — the first three hold, the last does not. A token minted `SCOPED` with `{"content":["read","update"]}` can read and rewrite entries of *every* content type: an integration token issued for `blog-post` can rewrite `staff-profile` or `pricing`. The RBAC side already implements this dimension (`permission-resolver.service.ts:106-112` matches against `target.scopeValue`), so the plumbing exists and only the token path skips it. **Decision needed:** whether absent `scopeData` for a type means deny (breaking change for any existing scoped token) or allow.

**SEC-06** (was `MCP-02`, half of `9.3-3`). `mcp.controller.ts` declares no guard or role decorator. `JwtAuthGuard` accepts `['jwt','api-token','agent-token']`; `TokenPolicyGuard` returns `true` for non-token principals and for FULL_ACCESS tokens; `RolesGuard` lets any system-role holder through an undecorated route; and `McpService` then explicitly waives scope checking for anything that is not an agent token — `if (user.isAgentToken !== true) return true;` (`mcp.service.ts:117`). P0-03 stopped agent tokens leaking *out* to REST; nothing stops a stolen admin JWT or a FULL_ACCESS API token driving the entire MCP tool surface — including `delete_content_entry` and `get_audit_log` — with zero scope restriction and **no `AgentSession` record**, making that activity invisible in the per-token history operators are told to audit. **Decision needed:** whether MCP is agent-token-only (clean, breaks any JWT-driven tooling) or accepts JWTs with the RBAC resolver applied.

**SEC-07** (was `P0-04b`). `permission-matrix.tsx:46` offers `read, create, update, delete, publish`. The route deriver produces eighteen more (`route-permission.util.ts:36-51`: unpublish, archive, restore, schedule, revert, locale, duplicate, enable, disable, install, uninstall, test, validate, import, export, revoke, permanent-delete). `grep -n permission apps/api/prisma/seed.ts` returns nothing — the `Permission` table ships empty — and `role.dto.ts:41-53` accepts free-form strings with no catalog validation. So a custom role built through the UI can do five things and nothing else, *and* a super-admin who POSTs the documented dotted name `content.version.revert` (from `KAST_SECURITY_MODEL.md` §6) stores a permission that will never match the derived `revert` and silently grants nothing, with no validation error. **Decision needed:** the canonical action vocabulary — derived verbs or documented dotted names — before seeding.

**SEC-08** (was `P0-04c`). `roles.guard.ts:55-61`: with no `@Roles` metadata it returns `userRoles.some(role => SYSTEM_ROLE_NAMES.has(role))`, and the permission resolver is never consulted. Undecorated protected handlers: `tokens.controller.ts:18,24,33` (list/create/revoke API tokens), `agent-token.controller.ts:31,37,46`, `mcp.controller.ts:19,36`. Tokens are always minted for `user.id`, so this is **not** privilege escalation — but a VIEWER can mint a FULL_ACCESS API token with no expiry, and since `GET /tokens` lists only the caller's own tokens and there is no admin-wide inventory, that credential survives session revocation and appears in no operator view. The guard's own comment acknowledges this is a deliberate carry-over. **Decision needed:** deny-by-default on undecorated routes is a one-line change that touches every controller's contract at once.

**SEC-09** (was `P0-02a`). `create-token-dialog.tsx:30` offers `SCOPED`; the dialog builds its body at `:44-48` with only name/scope/expiresAt and never sends `scopeData`; `tokens.service.ts:52-54` throws `BadRequestException('scopeData is required when scope is SCOPED')`. Selecting SCOPED in the admin panel is a guaranteed 400. The only scoped-token enforcement the remediation built is unreachable through the product's own UI — operators will conclude scoping is broken and fall back to FULL_ACCESS, which is the outcome the work was meant to prevent. Fix this together with SEC-05.

**SEC-10** (was `AUTH-10a`). `auth.service.ts:238-242`: `findOrCreateUserByEmail` rejects only an explicit `verified === false`, then returns the existing user by email **before** reaching `oauthPolicy.canProvision()` at `:245`. `passport-github2` never populates `verified`, so it is `undefined` on every GitHub login and `OAUTH_SIGNUP_REQUIRE_VERIFIED` is skipped for account *linking*. Any provider asserting an address without a verification flag logs the caller straight into the pre-existing local account with that email — including `admin@kast.local` — with no password and no policy check. GitHub's own primary-email rules mitigate this today; the gate is not enforced by Kast, so a self-hosted or additional OIDC provider makes it exploitable. **Decision needed:** whether linking should require verification, or an explicit account-linking confirmation step.

### 1.3 Data loss and destructive behaviour

| ID | Gap | Sev | Effort | Decision | Migration |
|---|---|---|---|---|---|
| **SEC-11** | `STORAGE_PROVIDER=gcs` boots clean and writes uploads to ephemeral local disk | High | M | Yes | No |
| **SEC-12** | Redis has no AOF, no password, and its port is published | High | S | No | No |
| **SEC-13** | Scheduled publishing depends solely on Redis; rescheduling silently keeps the old time | High | M | Yes | No |
| **SEC-14** | Media purge deletes the DB row even when storage deletion fails | Medium | M | No | No |
| **SEC-15** | Restoring a trashed user silently reactivates a suspended account | Medium | M | Yes | **Yes** |
| **SEC-16** | Malformed `Stripe-Signature` v1 → unauthenticated 500 + logged stack per request | Medium | S | No | No |
| **SEC-17** | SVG served inline from S3/R2 if an operator re-enables the MIME type | Medium | M | Yes | No |
| **SEC-18** | Public media route serves objects belonging to trashed `MediaFile` rows | Low | S | Yes | No |

**SEC-11** (was `MED-07`, `13.2-a`). `env.schema.ts:68` accepts `'gcs'`; `media.module.ts:47-50` maps only `r2` and `s3` and falls through to `local` with no log line. Verified: the enum accepts `gcs` and the module returns the local adapter. An operator who sets `STORAGE_PROVIDER=gcs` gets a booting API that writes every upload to container-local disk — on an ephemeral host that is data loss discovered only at the next pod restart. The one signal is a warning inside `settings.service.ts:159-163`, visible only if someone clicks Test Connection. **Decision needed:** drop `gcs` from the enum (one line, honest) or build the adapter.

**SEC-12** (was `13.1-e`, `8.10-c`). `docker-compose.yml:23-34`: `redis:7-alpine`, a `redis_data:/data` volume, **no `command:`** so `appendonly` stays at its `no` default, **no `requirepass`**, and `ports: - '6379:6379'`. Same shape in `create-kast-app/src/templates/docker-compose.ts:30-41`. `apps/docs/.../docker-compose.md:57` describes the volume as "Redis AOF/RDB snapshots" — actively misleading. Two consequences: on any host without a firewall, an unauthenticated Redis holding queue and session data is reachable from the network, and an attacker can enqueue jobs into `kast.webhook` (SSRF) and `kast.email` (mail from your domain); and a Redis restart loses everything since the last RDB snapshot, which combined with SEC-13 means scheduled entries never publish and queued password-reset emails vanish with no error anywhere. This is three lines of YAML plus a docs correction.

**SEC-13** (was `CON-07`, `8.10-d`). Two distinct defects, both confirmed:
1. **Reschedule silently keeps the original time.** `content-schedule.ops.ts:9-11` derives a deterministic `jobId` = `publish-${entryId}`, and BullMQ ignores an `add` with a duplicate job id. `content.service.ts:302-311` `schedulePublish` has no status guard — `requireWritableEntry` checks only `trashedAt` — so re-scheduling an already-SCHEDULED entry is reachable. The new `publishAt` is written to the database while the queued job stays at the **original** time. Moving an embargo later publishes the content early, while the UI and API report the new time. The admin only offers Schedule from DRAFT, so this is safe from the UI, but the REST API, the SDK and any MCP agent hit it.
2. **No reconciliation.** `grep -rn '@Cron' apps/api/src` returns exactly one hit (`trash.scheduler.ts:14`). Nothing sweeps `ContentEntry where status='SCHEDULED' and scheduledAt <= now()`. Any lost delayed job leaves entries stuck in SCHEDULED forever with no retry, alert or recovery path short of manual SQL.

The remediation did add a real mitigation — `publish.processor.ts:28-31` is now a conditional `updateMany`, so an orphan job no-ops instead of republishing. **Decision needed:** outbox pattern versus a reconciliation cron; the cron is far cheaper and closes both halves.

**SEC-14** (was `MED-10`). `media.service.ts:205-208` swallows every storage error into `logger.warn` and then deletes the row anyway. When the bucket is unreachable or credentials have rotated, the row disappears and the objects stay forever — and once the row is gone, nothing can name those keys again, so the bytes are unreclaimable and invisible. No retry, no dead-letter, no reconciliation (`grep -rn 'orphan' apps/api/src` → no match). The purge is also over-approximating by design (`derived-keys.util.ts:20-21`): a file genuinely uploaded as `name.webp` triggers a delete attempt on the unrelated key `name`, harmless only because nothing else writes that namespace.

**SEC-15** (was `TRASH-04`). The reported defect *is* fixed — `trash.service.ts:316-322` restores with `isActive: true`, pairing with `users.repository.ts:140` which sets `isActive: false` on trash. But the pre-trash state is recorded nowhere: `User` has only `isActive`, `trashedAt`, `trashedByUserId`, and deactivation is an independent path (`users.service.ts:186`). An account deactivated for cause and then trashed can sign in the moment anyone restores it. **Migration needed:** a column recording pre-trash `isActive`.

**SEC-16** (was `10.2-STRIPE-hmac`). `stripe.controller.ts:91` calls `crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1))` with no length guard on the attacker-controlled `v1`; Node throws `RangeError: Input buffers must have the same byte length`. `GlobalExceptionFilter` catches non-`HttpException` as 5xx, logs the stack, and fires the error reporter. **Corrected scope:** the handler returns 503 unless `STRIPE_WEBHOOK_SECRET` is set, and a ±300s replay guard runs first — so this needs a Stripe-configured instance and a current timestamp, both trivial. On such an instance, anyone on the internet can POST `stripe-signature: t=<now>,v1=x` and get a 500 plus a logged stack trace and an alert event per request: a free log/alert-flood primitive that also misleads operators into thinking Stripe is broken. A length check is one line.

**SEC-17** (was `MED-08`). Default is now safe — `env.schema.ts:87-89` excludes `image/svg+xml` — and the local adapter forces `attachment` with `default-src 'none'; sandbox`. Uncovered: `s3-storage.adapter.ts:36-38` and the R2 equivalent set `ContentType` from the upload with no `ContentDisposition`, and objects are served straight from the bucket origin. `mime-magic.util.ts:16-25` has no SVG signature, so `validateMagicBytes` returns its permissive `true`. An operator who re-enables SVG (a plausible thing to do for logos) while on s3 or r2 gets stored XSS on the bucket origin; the same file on local storage only downloads. Nothing warns that the two providers differ. **Decision needed:** sanitize, or force `ContentDisposition: attachment` on non-inline-safe types at PUT time.

**SEC-18** (was `P0-01d`). `media-file.controller.ts:25-33` is `@Public` and resolves purely on the filesystem via `local.resolveObject(storageKey)` — it never consults the `MediaFile` table, so `trashedAt` is not considered. Contrast `delivery.repository.ts:80-88` `findMediaUrls`, which does filter `trashedAt: null`. Mitigations genuinely in place: keys are `randomUUID()`, traversal and symlink escape are blocked, non-image types are forced to `attachment` with a locked-down CSP, and the route 404s when a non-local adapter is active. Net effect: trashing a media file removes it from the API and delivery payloads, but the bytes stay fetchable at their original URL until permanent delete. This mirrors a public S3 bucket, which is what the controller doc claims to imitate — **so it may be an accepted trade-off, but it should be an explicit one.**

### 1.4 Anonymous surface residue

The core P0-01 blocker is genuinely closed. `@Public()` now appears only on auth, health, delivery, robots, sitemap, stripe, form submit and media files; every management controller carries `@Roles`; and `public-surface.e2e-spec.ts` asserts 401 for anonymous callers on content-types, media, settings, menus, search and trashed entry detail. What follows is the residue on the delivery routes themselves.

| ID | Gap | Sev | Effort | Decision | Migration |
|---|---|---|---|---|---|
| **SEC-19** | Delivery menu route returns raw `MenuItem` rows: internal `entryId`s and `isActive:false` items | Medium | S | No | No |
| **SEC-20** | `RELATION` values reach delivery as raw entry ids, unresolved and unfiltered | Low | S | Yes | No |
| **SEC-21** | Delivery schema route publishes every content type's field list with no opt-out | Low | M | Yes | Yes |

**SEC-19** (was `P0-01a`) — verified in full. `delivery.controller.ts:45-48` (`@Public GET delivery/menus/:slug`) → `delivery.service.ts:265-268` returns `this.menus.findBySlug(slug)` verbatim → `menu.service.ts:26-30` → `menu.repository.ts:69-76` `return { ...menu, items: buildTree(menu.items) }`, and `buildTree` (`:165-187`) copies every column and filters nothing. `MenuItem` in the schema carries `entryId String?` and `isActive Boolean @default(true)`. No projection layer exists — contrast `delivery.repository.ts:5-6`, whose comment reads "The public payload carries resolved media URLs, never internal MediaFile ids." `delivery.e2e-spec.ts` has no menus test at all. An anonymous caller fetching a site menu receives the internal `ContentEntry` id of every linked entry — including DRAFT, SCHEDULED and trashed ones — plus every item an editor deliberately deactivated, which a trusting front end will render. Same class of leak P0-01 was raised for, on the one delivery route the remediation did not project.

**SEC-20** (was `P0-01c`). `delivery.service.ts:93-98` `projectData` special-cases only `ContentFieldType.MEDIA` for id→URL resolution; every other type, `RELATION` included, is copied verbatim, and nothing checks that the referenced entry is published or non-trashed. A published entry relating to a draft leaks that draft's id. Exploitability is limited — delivery lookups are by slug, not id, and management routes 401 — so this discloses an opaque identifier and the *existence* of unpublished related content, not its contents. Worth naming only because the media path was explicitly hardened against exactly this and the relation path was not.

**SEC-21** (was `P0-01b`, and `CON-09` from the other direction). `delivery.service.ts:203-210` `listSchemas()` calls `contentTypes.findAll()` with no filter. The projection is careful — ids, config, `defaultValue` and hidden fields are all dropped — so the leak is bounded to name, displayName, `isLocalized` and each visible field's name/type/required/localized. The report's required correction was "add published-only public content-type/schema endpoints **only if explicitly required**"; the remediation added an always-on, all-types version. An operator with internal-only content types has no way to keep their existence and field list private. This is not a re-opening of P0-01 — no entry data escapes — but it is a widening of the anonymous surface that was not gated behind a decision. **Decision needed:** a per-type `isPubliclyDiscoverable` flag, or accept.

### 1.5 Plugin execution model

| ID | Gap | Sev | Effort | Decision | Migration |
|---|---|---|---|---|---|
| **SEC-22** | A rejecting plugin handler is an unhandled rejection that kills the API process | High | M | No | No |
| **SEC-23** | Manifest permissions are a startup string check, not a sandbox — and a legal permission crashes boot | High | L | Yes | No |

**SEC-22** (was `PLUG-07`). `plugin.loader.ts:156-160`: `on(event, handler) { emitter.on(event, (payload) => { void handler(payload); }); }`. No try/catch, no `.catch()`, no per-plugin isolation. `void promise` attaches no rejection handler, and on Node 20 an unhandled rejection terminates the process by default. A handler that throws synchronously propagates straight back into `content.service.ts:233`'s `emit('content.published', …)`, turning a publish into a 500. The shipped plugins happen to try/catch their own bodies, so the platform survives only because every first-party plugin is defensive — the contract guarantees nothing. A `.catch()` with a logger is a two-line fix and should be done regardless of what happens to the rest of the plugin system.

**SEC-23** (was `PLUG-05`). `plugin.loader.ts:25-31` `ALLOWED_PERMISSIONS` is a `Set` of five strings; `:97-104` `enforcePermissions` compares declared strings and is never consulted again. Plugins are `require()`d into the API process with full Node capability, so a plugin declaring `content:read` can still read `process.env` (every secret), the filesystem and the network — the permission list is documentation. Separately and more urgently: `packages/plugin-sdk/src/types.ts:6` declares `SETTINGS_WRITE='settings:write'`, which is **not** in `ALLOWED_PERMISSIONS`, and the throw at `:100` happens inside the un-try/catch'd loop in `onApplicationBootstrap`. A plugin author who declares a permission the published SDK enum offers does not get their plugin skipped — the exception escapes and **the entire API fails to start**. One malformed third-party manifest is a full outage. The boot-crash half is small and should be split out from the sandbox question. **Decision needed:** real isolation (worker threads / VM) is a large architectural commitment; reconciling the enum and catching per-plugin is not.

---

## 2. Advertised but does not work

### 2.1 MCP — the headline feature does not connect

This is the largest single block of open work and the one with the widest gap between positioning and reality. It was explicitly out of the remediation's scope, so nothing here is a regression — but the product is described as AI-native and the documented integration path fails at connect time.

| ID | Gap | Sev | Effort | Decision | Migration |
|---|---|---|---|---|---|
| **MCP-A** | SSE stream never emits the `endpoint` event; POST and SSE are not one transport | **Critical** | L | Yes | No |
| **MCP-B** | Tool arguments are never validated against the advertised `inputSchema` | High | M | No | No |
| **MCP-C** | Registered tool set has zero name overlap with the PRD's required 15 | High | L | Yes | No |
| **MCP-D** | Denied and failed tool calls are never audited | High | S | No | No |
| **MCP-E** | MCP audit rows carry `userId` only; `agentTokenId`/`agentName` never written | High | S | No | No |
| **MCP-F** | No MCP conformance or integration test at any level | High | M | No | No |
| **MCP-G** | Dry-run covers 7 of 15 tools; publish/delete previews assert success without checks | High | M | No | No |
| **MCP-H** | Agent scopes are free-text tool names with no allow-list or JSON scopes | Medium | M | Yes | No |
| **MCP-I** | `tools/list` is unfiltered; scopes are not checked at connection | Medium | S | No | No |
| **MCP-J** | MCP uses a private role-level comparison, so custom RBAC does not apply | Medium | M | No | No |
| **MCP-K** | Denials return a bare `FORBIDDEN`, not `SCOPE_DENIED`; no latency recorded | Medium | S | No | No |
| **MCP-L** | `AgentSession` is one row per successful call, blank name, zero duration | Medium | M | Yes | **Yes** |
| **MCP-M** | SSE session state lives in a per-process in-memory `Map` | Medium | L | Yes | No |
| **MCP-N** | No heartbeat, no session expiry, no backpressure; `ping` not implemented | Medium | M | No | No |
| **MCP-O** | Protocol version hardcoded `2024-11-05` with no negotiation; no official SDK | Medium | L | Yes | No |
| **MCP-P** | PRD is the one surface still listing the `kast_*` tool names | Medium | S | Yes | No |

**MCP-A** (was `MCP-09`) is the row that makes the rest academic, and I verified it directly. The SSE handler writes exactly one frame — `event: message` with a non-JSON-RPC body `{type:'session',sessionId}` (`mcp.controller.ts:27-29`) — then nothing until close. `McpSessionStore.send`, the only code that could push a JSON-RPC message onto a stream, is **never called**: `grep -rn "sessionStore\.\|\.send(" apps/api/src/modules/mcp/` returns only `create` (line 27) and `remove` (line 32). The POST handler ignores the session id entirely and returns the RPC result in the HTTP body. The server advertises `protocolVersion '2024-11-05'`, whose HTTP+SSE transport requires the server's first SSE event to be `event: endpoint` carrying the POST URI. So a real MCP client connects, waits for an endpoint event that never arrives, and times out — the exact integration `apps/docs/.../mcp/connecting-claude.md` instructs users to configure. The JSON-RPC-over-POST behaviour that *does* work is Streamable-HTTP shaped, but it is served at a path documented as SSE and announced with a protocol version that predates Streamable HTTP, so no stock client is configured to reach it. **Decision needed:** implement 2024-11-05 SSE properly, or move to Streamable HTTP and re-document — the second is closer to where the code already is.

**MCP-B** (was `MCP-04`) is the concrete availability risk. `inputSchema` is only ever echoed in `tools/list`; no JSON-schema validator exists in `apps/api` (zod is present but unused by the MCP module, and there is no ajv). The global `ValidationPipe` cannot help because `@Body() body: McpRequest` is a TypeScript *interface*, so the runtime metatype is `Object` and the pipe skips it. Handlers cast blindly: `this.mediaService.findAll(args as PaginationDto)`. Concretely, `tools/call {name:'list_media', arguments:{limit: 1000000}}` reaches `media.repository.ts:40` as `take: 1000001` and pulls the entire media table into memory — the REST route is capped at `Max(100)` by `PaginationDto`, the MCP route is not. `{limit:'abc'}` produces `take: 'abc1'` and a raw Prisma error echoed back to the caller. Undeclared arguments are forwarded too, and missing required args become `undefined` casts.

**MCP-D + MCP-E** (were `MCP-05`/`8.9-h` and `MCP-06`/`8.9-g` — merged; four auditors reported these from two angles). Both denial branches return before any audit call (`mcp.service.ts:68-70` and `:72-74`), and `auditService.logAction` is reached only at `:98`, *after* the handler has already succeeded; the catch at `:110-113` writes nothing either. So an agent token can probe all 15 tools, or repeatedly attempt a publish it is not scoped for, and leave no trace in `AuditLog` or `AgentSession`. PRD AC-MCP-002 ("Audit log records the denied attempt") fails outright. Separately, the success-path call passes `{action, resource:'mcp_tool', userId, changes, isDryRun}` — no `agentTokenId`, no `agentName`, no `resourceId` — even though `LogActionParams` declares both fields, `AuditService` writes them, the table has both columns *plus an index on `agentTokenId`*, and `AuthUser` carries `agentTokenId` (it is used ten lines further down at `:125`). `grep -rn agentName apps/api/src` finds no producer anywhere. Every MCP write is attributed to the human who owns the token and is indistinguishable from that human's own admin activity; the audit CSV export has an `agentTokenId` column that is always empty. If one user owns three agent tokens, an incident cannot be traced to the compromised one. **These two are small, mechanical, and worth doing even if the transport rework is deferred** — they turn an invisible surface into an auditable one.

**MCP-G** (was `MCP-12`, partial). Seven of fifteen tools declare `dryRunable: true`; the other eight hard-fail with `-32602`. Of the seven, only the two entry-data paths actually validate (`assertPayloadValid`, `validateUpdateWithoutWriting` — this is the part `dry-run-parity.spec.ts` covers). The dangerous half is the false green: `publishContentEntry`'s dry run returns `{action, entryId, wouldPublish:true}` and returns immediately, while the real publish runs `gate.assertStoredPublishable` **and** `assertSeoPublishable(await seoService.validateNow(id))`. An agent asks the operator to approve a publish, the preview says `wouldPublish:true`, the operator approves, and the real call is rejected by the SEO gate. Same for `deleteContentEntry`, `createContentType` and `updateContentType`. AC-MCP-003 specifies the publish preview return `{wouldPublish, seoScore, warnings}` — it returns none of those.

**MCP-C / MCP-P** (were `MCP-01`, `9.3-9`). Fifteen `@McpTool` decorators exist and are correctly registered with no name collisions — the report's section 9.1 inventory claim checks out. But there is **zero name overlap** with the PRD's required list, and eight capabilities are absent entirely: unpublish, add-field, three plugin tools, media upload, redirect create, user create. `ContentService.unpublish` exists at `content.service.ts:250` and is simply not exposed. Encouragingly, the drift is narrower than the report implies: code, the admin scope selector (`create-agent-token-drawer.tsx:18-38`) and the whole docs site all agree on the same 15 names — **only `KAST_PRD.md:1845-1861` still lists the `kast_*` set.** That is drift in the governing document, which is the worse direction, but it means the fix is a single decision about which artifact is authoritative, and that decision is the same one as MCP-C.

**MCP-J** (was `9.3-5`) deserves a note because it interacts with the P0-04 work: `McpService.hasRole` reduces roles through `ROLE_HIERARCHY` and compares numeric levels, defaulting an unknown role to 0, and never injects `PermissionResolverService`. So the custom-RBAC work does not reach MCP at all — a user holding only a custom role, even one granted `content:read` and `content:publish`, scores 0 and is refused every MCP tool, making their agent tokens inert. Two authorization models now disagree about the same principal.

### 2.2 Plugins — the extension system does not extend

| ID | Gap | Sev | Effort | Decision | Migration |
|---|---|---|---|---|---|
| **PLG-A** | Production API image contains no plugins directory; `PLUGINS_ROOT` resolves to `/plugins` | High | M | Yes | No |
| **PLG-B** | Disable does not stop code — the loader never reads `isActive` | High | S | No | No |
| **PLG-C** | Uninstall deletes metadata only; the row resurrects **enabled** on next boot | High | M | Yes | No |
| **PLG-D** | Install only inserts a DB row — nothing is fetched, verified, or placed on disk | High | L | Yes | **Yes** |
| **PLG-E** | Context exposes `on`/`getConfig`/`setConfig` only — no extension registration of any kind | High | L | Yes | No |
| **PLG-F** | Core's optional `@sentry/node` import can never resolve — Sentry is dead everywhere | High | S | Yes | No |
| **PLG-G** | Manifest `adminPages` are inert; admin plugin screens are hand-written core code | Medium | L | Yes | No |
| **PLG-H** | The plugin control plane has zero automated tests | Medium | M | No | No |

**PLG-A** (was `PLUG-04`, `13.1-d`). `plugin.loader.ts:16` resolves `path.resolve(__dirname, '../../../../../plugins')`; with `dist` at `/app/dist` in the runner image that is `/plugins`, and `:54` returns silently when it does not exist. No Dockerfile copies plugins. No compose, Railway or Render file mounts one. Even bind-mounting would not work — the plugins' own dependencies (`meilisearch`, `stripe`, `resend`, `@aws-sdk/client-s3`, `@sentry/node`) are not in the `pnpm deploy --filter @kast-cms/api --prod` output. So every plugin capability the product advertises is dead in the shipped container: zero plugins load, `GET /api/v1/plugins` is permanently empty, and the admin Plugins screen shows nothing with no diagnostic.

**PLG-B + PLG-C** (were `PLUG-02`, `PLUG-02b`, `PLUG-03`) — verified together, and the interaction is worse than either row alone. The loader's `onApplicationBootstrap` → `loadPlugin` path goes manifest → permissions → import → `upsertFromManifest` → `instance.onLoad()` with **no DB read at all**; `isActive` appears nowhere in `plugin.loader.ts`. So the admin Enable/Disable switch writes a boolean and nothing else: a disabled plugin keeps its handlers registered for the process lifetime and, after the restart the Swagger text promises will help, loads again and runs `onLoad`. Because the upsert's `update` branch leaves `isActive` alone (correcting the original report), the row correctly stays `false` while the code runs — **so the console shows "Disabled" for a plugin whose handlers are live.** Uninstall is worse: `repo.remove(name)` deletes the row, no files are touched, and the next bootstrap hits the upsert's `create` branch, which sets `isActive: true`. Uninstalling `kast-plugin-stripe` therefore removes the row, leaves the code running until restart, and at restart recreates the plugin as installed *and enabled* — while silently discarding the `PluginConfig` row via `onDelete: Cascade`. An operator disabling a misbehaving plugin to stop outbound writes does not stop them.

**PLG-E** (was `PLUG-EXT-01`, and the root cause of `10.2-R2-register`, `10.2-RESEND-register`, `10.2-SENTRY-hooks`, `10.2-STRIPE-mount`). `KastPluginContext` is exactly `{ on, getConfig, setConfig, pluginName }` — verified in both the SDK types and `buildContext`. There is no `registerStorage`, `registerEmailTransport`, `registerRoute`, `registerErrorHook`, or content accessor. "Plugin" in Kast currently means "event subscriber", which is materially narrower than the integrations the repo ships. The four downstream instances, all with the limitation documented in their own source comments:

- **R2** builds an `S3Client`, holds credentials in memory, and is never called — storage is chosen solely by `STORAGE_PROVIDER` against the core adapter. An operator follows the plugin's admin page, sets `R2_*`, sees "Active", and is still writing to local disk.
- **Resend** cannot register a transport; `email.processor.ts:53-54` reads `RESEND_API_KEY` itself. Two code paths hold the same credential and only the core one ever sends mail; disabling the plugin changes nothing.
- **Sentry** cannot hook the error pipeline; handled 5xx responses — the ones you want alerts on — never reach it.
- **Stripe**'s `handleWebhook`/`createCheckoutSession` are unreachable. The core `@Public` webhook route verifies the signature and then only does `emitter.emit('stripe.' + event.type, …)` — a namespace no `PluginHook` value covers, so the plugin cannot even subscribe. Inbound `checkout.session.completed` events are received and discarded, and there is no checkout endpoint at all.

**PLG-F** (was `10.2-SENTRY-dep`) — verified and it is worse than the original report framed it. Both `main.ts:72-85` and `sentry.service.ts:27-41` do `await import('@sentry/node')` inside an empty catch. The **only** declaration of `@sentry/node` anywhere in the repo is `plugins/kast-plugin-sentry/package.json:11`; it is absent from `apps/api` dependencies and devDependencies, and `node_modules/@sentry` does not exist. So both core paths silently fall into their catch and return `undefined`: setting `SENTRY_DSN` produces no error reporting whatsoever, and the failure is invisible because the catch is empty. In the production image the plugin that owns the dependency is not copied either (PLG-A), so **there is no configuration of Kast in which Sentry works.** This is a one-line `package.json` fix plus removing the empty catch.

### 2.3 Features that save successfully and do nothing

| ID | Gap | Sev | Effort | Decision | Migration |
|---|---|---|---|---|---|
| **ADV-01** | SMTP settings govern only the test button; real mail uses env — and the admin says otherwise | High | M | Yes | No |
| **ADV-02** | SEO redirects never apply to public navigation, and no public contract exposes them | High | L | Yes | No |
| **ADV-03** | Opening any file in the admin media library crashes; `ContentRelation`/`MediaUsage` are never written | High | L | Yes | No |
| **ADV-04** | Site Name and Site URL are inert, and the field hint asserts an effect the code contradicts | Medium | M | Yes | No |
| **ADV-05** | Settings created from the admin can never be made public — SDK type omits `isPublic` | Medium | S | No | No |
| **ADV-06** | Seed writes `site_name`/`default_locale`; the admin edits `site.name` — disjoint namespaces | Low | S | Yes | No |
| **ADV-07** | Multipart upload silently ignores `folderId`; files land at the root | Medium | S | No | No |
| **ADV-08** | `PATCH /media/:id` with the documented `caption` returns 500 — the column does not exist | Medium | S | Yes | **Yes** |
| **ADV-09** | `user.created` is offered in the UI and listened for, but never emitted | Medium | S | No | No |
| **ADV-10** | Documented `media.deleted` and other lifecycle events do not exist and cannot be subscribed | Medium | M | Yes | No |
| **ADV-11** | Webhook delivery listing is capped at 100 with no pagination, hiding redelivery ids | Medium | S | No | No |
| **ADV-12** | Version retention is honestly labelled inert, but versions still grow without bound | Medium | M | Yes | No |
| **ADV-13** | Thumbnails are generated and stored but no response carries their URL | Medium | L | Yes | **Yes** |
| **ADV-14** | WebP optimization orphans the original for the life of the row; `size` undercounts | Medium | M | Yes | **Yes** |
| **ADV-15** | `AiContentGeneration`/`AiImageGeneration` tables have zero application references | Low | S | Yes | **Yes** |

**ADV-01** (was `8.4/smtp.*`) is the worst-shaped failure in the settings area, and I confirmed both halves. `email.processor.ts:64-70` builds its transporter **once, at construction**, from `SMTP_HOST/PORT/SECURE/USER/PASS` with defaults `localhost:1025` — it never reads `GlobalSetting`. `settings.service.ts:210-222` builds a *different* transporter from the DB rows, used only by `testSmtp`. The API is internally honest — `settings-catalog.ts:19-20` carries `ENV_SMTP_NOTE: 'queued mail is still sent with the SMTP_* environment variables'`, returned as `enforcedBy` — but **nothing renders it**: `grep -rn 'enforcedBy' apps/admin/src packages/sdk/src` has no match, and `email-tab.tsx:117-120` asserts the opposite ("The relay used for password resets, invitations and notifications"). So an operator fills in their real relay, clicks Send test email, receives it, and concludes mail is configured — while every password reset and invitation afterwards goes to `localhost:1025` and is silently lost. The API knows and says so in a field the UI throws away. Note that surfacing `enforcedBy` in the SDK and admin also fixes half of ADV-04 and ADV-05.

**ADV-02** (was `SEO-05`). `delivery.module.ts:21` registers `RedirectMiddleware` on the Nest API app only, and `redirect.middleware.ts:35` even skips `/api` paths — so it can fire only on non-API paths hitting the API host. No public redirect contract exists: the only read routes are `GET /v1/seo/redirects` (`@Roles(VIEWER..)`) and the ADMIN+ export. The `@Public` DeliveryController exposes sitemap, settings, schema, menus and content — no redirects. In the split-origin deployment the docs describe, an editor creates a 301, the rule is stored, and visitors to the old URL get the frontend's 404. A frontend cannot even fetch the rules to apply them itself without embedding an admin bearer token. Same code in the generated scaffold. **Decision needed:** a public redirects endpoint the frontend polls, or a documented middleware package.

**ADV-03** (was `CON-12`) — two failures, and the first is a live crash. `file-detail.tsx:67` does `file.usages.length`; the API returns a bare Prisma `MediaFile` with no `usages` key (`media.service.ts:169-173` → `repo.findById`, no include). TypeScript is satisfied because `packages/sdk/src/types.ts:227-261` declares `usages: MediaUsage[]` and `usagesCount` — **the SDK type lies**, so this surfaces only at runtime, and opening any file in the media library throws. Second: `grep -rn 'contentRelation\.\|mediaUsage\.'` across `apps/api/src`, `packages` and `plugins` returns **zero hits** — no Prisma call touches either table. Relation and media values are validated for existence and then stored as raw JSON. So even once the crash is patched, "is this image used anywhere?" is unanswerable, the delete protection the same component tries to implement (`disabled={inUse}`) can never fire, and deleting a referenced entry or file silently leaves dangling ids inside other entries' JSON. **The crash is a small fix and should not wait for the tables.**

**ADV-04 / ADV-05 / ADV-06** form one knot worth untangling together. `settings-catalog.ts:23-24` claims `site.name` and `site.url` are enforced by "GET /delivery/settings, when the row is marked public" — but delivery returns only `isPublic` rows, and nothing in the admin or SDK can set `isPublic` (`settings-types.ts:17-20` `SettingPatchEntry` is `{key; value}`), so no admin-created setting is ever public. `grep -rn 'site\.name\|siteName' apps/api/src` returns only the catalog entry and a DTO doc comment — no consumer. Meanwhile `general-tab.tsx:54` tells the operator it is "Used wherever the instance names itself, such as email subjects", while those subjects are hardcoded (`email.processor.ts:107,126`), and `site.url` is unread because the sitemap base comes from `config.get('SITE_URL')`. On top of that the seed writes **snake_case** `site_name` and `default_locale` with `isPublic: true`, which the admin never reads — so a fresh install shows an empty Site Name in the admin while `/api/v1/delivery/settings` publicly returns `site_name='Kast CMS'`, and saving in the admin creates a second, private row that changes nothing. `default_locale` is published to anonymous callers while the real default lives in the locales table.

**ADV-08** (was `MEDIA-EXTRA-01`) — verified against the schema: `grep -n caption apps/api/prisma/schema.prisma` returns nothing, while `media.controller.ts:43` advertises `caption` with `@ApiPropertyOptional` (so it is in the OpenAPI spec) and `media.service.ts:177-182` passes it straight to `prisma.mediaFile.update`. That raises `PrismaClientValidationError`, which `global-exception.filter.ts:99-105` does not map (it handles only `PrismaClientKnownRequestError`), so it falls through to a 500. Not reachable from the admin, so it is a contract bug against integrators. **Decision needed:** add the column or drop it from the DTO.

### 2.4 Scaffolder — `create-kast-app`

| ID | Gap | Sev | Effort | Decision | Migration |
|---|---|---|---|---|---|
| **CLI-A** | MinIO is offered by the CLI and rejected by the API env schema — generated project cannot boot | High | S | Yes | No |
| **CLI-B** | CLI output and generated README advertise `/mcp`; the served route is `/api/v1/mcp` | Medium | S | No | No |
| **CLI-C** | Plugin selections only set env vars; three of five set nothing at all | Medium | L | No | No |
| **CLI-D** | Frontend starter selection scaffolds no source, only a GHCR image reference | Medium | L | Yes | No |
| **CLI-E** | Locale choices are collected and never read by any template | Medium | M | No | No |
| **CLI-F** | Root `setup.sh` does `git init` / `remote add` / `commit` / `push` to upstream | Medium | S | No | No |
| **CLI-G** | Template parity covers 4 trees; plugin-SDK, API `package.json`, lint configs unguarded | Medium | M | No | No |
| **CLI-H** | CLI tests are filesystem-shallow — no install, build, migrate, boot, or login | Medium | L | No | No |

**CLI-A** (was `CLI-05`, and the MinIO half of `MED-07`) — verified both sides: `env.schema.ts:68` is `z.enum(['local','s3','r2','gcs'])` and `prompts.ts:139` offers `{ value: 'minio', label: 'MinIO' }` with `types.ts:1` typing it. `templates/env-example.ts:78` writes `STORAGE_PROVIDER={{storageProvider}}` verbatim. So the scaffold completes successfully and the very first `pnpm dev` crashes with a zod enum error. **This is the single most embarrassing open item** — it is the first thing a new user does, it is a one-line fix either way, and CLI-H is exactly the class of test that would have caught it.

**CLI-B** (was `CLI-06`, `16-d` — merged). `index.ts:51,71` and `templates/readme.ts:88` print `http://localhost:${apiPort}/mcp`; `README.md:75`, `apps/docs/.../index.mdx:52`, `installation.md:41`, `api-reference/mcp-server.md:6` and — worst — `api-reference/agent-tokens.md:53` embed the same inside a copy-paste MCP client config block. The controller is `@Controller({path:'mcp', version:'1'})` under `setGlobalPrefix('api')` with URI versioning, and `main.ts` has no prefix exclusion, so the route is `/api/v1/mcp` and no `/mcp` alias exists. A user hits this from the CLI output *and* from the docs with no correct source to fall back on. (Even once fixed, MCP-A means the connection still will not work — but this should be corrected in the same pass.)

**CLI-G** is a genuine improvement worth acknowledging: `template-parity.test.mjs` now byte-compares `apps/api/src`, `apps/api/prisma`, `apps/admin/src` and `packages/sdk/src` with an empty exception list, 17 tests green. The claim "generated users receive the audited source" is now true for the substantive trees. Uncovered: `template/packages/plugin-sdk/src` (currently in sync but unguarded), `template/apps/api/package.json` (lacks `prepare-e2e-db`, adds a `postinstall`), and the lint configs.

---

## 3. Operational gaps

| ID | Gap | Sev | Effort | Decision | Migration |
|---|---|---|---|---|---|
| **OPS-01** | Health check probes PostgreSQL only — Redis, workers, storage all unmonitored | High | M | No | No |
| **OPS-02** | No backup, restore, migration-rollback or secret-rotation runbook | High | L | No | No |
| **OPS-03** | Root `docker-compose.yml` has no admin service | High | S | No | No |
| **OPS-04** | Default database password fixed in Compose *and* in the API's fallback URL | Medium | S | No | No |
| **OPS-05** | Standalone API image does not migrate; only Compose overrides the command | Medium | S | Yes | No |
| **OPS-06** | Audit writes are fire-and-forget, not transactionally coupled to the mutation | Medium | L | Yes | No |
| **OPS-07** | `kast.audit` queue is registered and displayed but has no producer or processor | Medium | M | Yes | No |
| **OPS-08** | No dead-letter, replay, idempotency or backlog-alert path — in code or docs | Medium | M | Yes | No |
| **OPS-09** | Bull Board auth accepts a full JWT in the query string; cookie has no `secure` | Medium | S | No | No |
| **OPS-10** | OAuth authorization codes live in one process's heap | Medium | M | Yes | No |
| **OPS-11** | No multi-instance guidance; trash cron, MCP sessions, local uploads all break at N>1 | Medium | M | Yes | No |
| **OPS-12** | One 902-line migration, misleadingly named `add_password_reset_token` | Medium | L | Yes | **Yes** |
| **OPS-13** | Storage credentials optional even when the selected provider requires them | Medium | S | No | No |
| **OPS-14** | CORS defaults to `*` with `credentials: true` and no production guard | High | S | No | No |
| **OPS-15** | Three Astro XSS advisories remain, gated out by `--audit-level=high` | Medium | M | Yes | No |
| **OPS-16** | Several `User` relations default to `Restrict`, so an authoring user can never be purged | Medium | L | Yes | No |

**OPS-01** (was `8.10-b`) — verified: `health.controller.ts:25-27` is literally `this.health.check([() => this.prismaHealth.pingCheck('database', this.prisma)])`, and there is no spec file anywhere under `modules/health`. With Redis down the API reports healthy, so an orchestrator keeps routing traffic while every webhook, email, media derivative, scheduled publish and trash purge silently stops. Same for a storage outage or a crashed worker. Combined with SEC-12 (no AOF) and SEC-13 (no reconciliation), the single green light is actively misleading. Adding a Redis indicator is small and buys the most per line of any item in this section.

**OPS-14** (was `13.2-c`). `env.schema.ts:52` defaults `CORS_ORIGINS` to `'*'`; `main.ts:106-112` passes `origin: '*'` with `credentials: true`, and there is no production guard anywhere. A production deployment that never sets `CORS_ORIGINS` runs wildcard. Browsers refuse credentialed requests against a wildcard, so the admin breaks in a way that looks like a bug and invites the operator to "fix" it by adding their origin blindly — and any non-browser client is unrestricted. Ranked high despite its size because the failure mode teaches the operator the wrong lesson.

**OPS-16** (was `TRASH-05`, partial). Real progress landed: purge deletes row-by-row inside try/catch, counts failures per model, and logs them. Still missing: `schema.prisma:161` (`createdBy` on ContentEntry), `:218` (`savedBy`), `:284` (`createdBy` on ContentType) and `:515` (`uploadedBy`) have no `onDelete` and therefore default to `Restrict`. So a trashed user who ever authored an entry, saved a version, created a content type or uploaded a file **can never be purged** — the scheduled job retries and fails every run forever (the spec output shows exactly this: `user: 0 deleted, 1 failed`), the row sits past its retention with no operator-visible reason, and a SUPER_ADMIN clicking permanent-delete gets a generic 422 "Database constraint violation" naming no dependency, because `global-exception.filter.ts:132-147` maps only P2002 and P2025.

**OPS-15** (was `14`, partial) — re-verified live: `pnpm audit --prod` on this commit reports exactly **3 vulnerabilities (1 low, 2 moderate)**, all `astro@6.4.8` reached through `apps/docs > @astrojs/starlight@0.40.0`. The lockfile confirms every other named package is patched (dompurify 3.4.13, next-intl 4.13.6, qs 6.15.3, body-parser 2.3.0, uuid 11.1.1, isomorphic-dompurify 3.10.0) — including the DOMPurify chain backing rich-text sanitisation. The residue is XSS in the docs site only, needs a major bump (astro 6→7), and has no API or admin runtime exposure. CI's `--audit-level=high` does not gate on them, so there is no forcing function. **Decision needed:** an allowlist-with-expiry, or accept and track.

### Audit logging (grouped — one subsystem, six symptoms)

The MCP-specific audit failures are MCP-D and MCP-E above. The HTTP path has its own set, none of which the remediation claimed to touch:

| ID | Gap | Sev | Effort |
|---|---|---|---|
| **AUD-01** | `before` is the incoming request body, not the prior persisted state | High | L |
| **AUD-02** | Denied and failed attempts are never written | High | M |
| **AUD-03** | Action/resource derived purely from method+path; `@AuditAction` used zero times | Medium | M |
| **AUD-04** | `after` is the serialized HTTP response, not a diff of the persisted row | Medium | M |

**AUD-01** — `audit.interceptor.ts:58` captures `req.body` and passes it as `params.before`. No repository read of the pre-mutation row exists. A PATCH sending only `{title}` records `before = {title: <new value>}` — identical to `after` — so the log **positively misrepresents** the change. "Who removed this user's admin role, and what was it before?" is unanswerable.

**AUD-02** — the write happens inside `tap()`, and the code's own comment at `:61-62` states it: "Only successful (2xx) responses reach `tap`; thrown errors skip it, so failed (4xx/5xx) requests are never written to the audit log." Neither the guards nor the exception filter reference `AuditService`. A brute-force run against admin routes, a compromised READ_ONLY token probing writes, or an agent hammering out-of-scope tools produces **zero rows**. The intrusion signal an audit log exists to provide is absent, and an attacker who never succeeds is invisible.

**AUD-03** — `deriveResource()` takes the first path segment and strips a trailing `s`, and `grep -rn '@AuditAction'` (non-spec) returns **0** despite the decorator existing. Every content mutation logs as `content-type.create`/`content-type.update` because the route is `content-types/:typeSlug/entries`. Publish, unpublish, schedule, bulk-trash and locale-clone are indistinguishable. The log cannot answer "who published this".

Taken together with OPS-06 (fire-and-forget writes) and OPS-07 (a registered `kast.audit` queue with no producer and no processor — which is also why the queue count reads 7 against 6 processors and why the phase docs contradict each other), the audit subsystem currently records the wrong before-state, omits every denial, mislabels the action, and can silently drop rows. It is trusted more than it deserves.

### Testing

`15.2-*` and `15.3-*` are real but diffuse. The honest summary: CI meaningfully improved — the API e2e suite now runs against an ephemeral `kast_test` Postgres and Redis on every PR, content-schema validation is thoroughly covered (six spec files), and admin logic tests exist where none did. What remains uncovered is precisely the load-bearing parts:

- **Zero spec files** in `agent-tokens`, `dashboard`, `health`, `locales`, `menus`, `plugin`, `publish`, `queue`, `search`, `stripe`; `mcp` has one, covering tool handlers against stubs and never constructing `McpService`. So: the agent-token strategy gating all MCP access, the plugin loader that executes third-party code in-process, the publish worker that is the only path scheduled content takes to going live, and the entire MCP request/session layer.
- **No MCP conformance test at any level** (MCP-F). Every protocol defect above — the missing `endpoint` event, responses never reaching the stream, unsupported `ping`, a response emitted for the id-less `notifications/initialized` — would have been caught by a single handshake against a stock client. There is no `@modelcontextprotocol/sdk` dependency in any package.
- **No Docker image smoke test.** `publish.yml` builds and pushes `ghcr` images on every push to `main` with no probe between build and push. OPS-05 and PLG-A are exactly what such a test catches, and both are shipping.
- **The authorization e2e matrix omits custom roles, viewer/admin JWTs, and inactive users** — so the P0-04 custom-RBAC fix rests on unit tests of the resolver alone, and a deactivated user's tokens continuing to work would not be caught.
- SDK has no tests at all and is published to npm independently; 4 of 6 plugins have `scripts.test === null`; no coverage thresholds anywhere.

---

## 4. Correctness and polish

| ID | Gap | Sev | Effort | Decision |
|---|---|---|---|---|
| **POL-01** | Version revert writes the snapshot slug verbatim — no normalization; no redirect on slug change | Medium | S | No |
| **POL-02** | Webhook payloads carry no version field or header | Medium | M | Yes |
| **POL-03** | `KAST_API_SPEC.md` documents `/api/v1/content/:type`; the API serves `/content-types/:typeSlug/entries` | Medium | M | No |
| **POL-04** | Forms docs: field names, enum casing and role claims still wrong; SDK page stale | Medium | S | No |
| **POL-05** | Security docs say bcrypt; the implementation is Argon2id | Medium | S | No |
| **POL-06** | SEO docs advertise `GET /api/v1/seo`, which does not exist | Low | S | No |
| **POL-07** | README names `apps/web-docs` as the Astro docs site; the real one is `apps/docs`, unmentioned | Low | S | No |
| **POL-08** | Docs URLs split between `kastcms.com/docs` and `docs.kast.dev` | Low | S | Yes |
| **POL-09** | Astro docs site has no `site` configured, so the sitemap is skipped | Low | S | Yes |
| **POL-10** | Security checklist and all three Phase Definitions-of-Done fully unchecked (30/10/11/18) | Low | M | No |
| **POL-11** | README banner says v1.0.2; tags have reached v1.2.0 | Low | S | Yes |
| **POL-12** | Next.js `typedRoutes` still under `experimental`; `middleware.ts` not migrated to `proxy` | Low | S | No |
| **POL-13** | SDK `exports['.']` orders `types` after `import`/`require`, so it is unreachable | Low | S | No |
| **POL-14** | Prisma configured via `package.json` rather than `prisma.config.ts` | Low | S | No |
| **POL-15** | CI does not generate Next route types, so `typedRoutes` is unchecked in CI | Low | S | No |
| **POL-16** | `format:check` fails locally on an untracked `.claude/settings.local.json` | Low | S | No |

**POL-01** (was `CON-04`, partial). The paths the report named are genuinely fixed — create, update, locale-add and implicit locale creation all normalize through `content-slug.ts`. Uncovered: `content-revert.ops.ts:59,63` write `payload.slug` from the version snapshot verbatim, with no `normalizeSlug`/`requireSlug`, and the snapshot copies whatever was stored. So an entry created before the fix can hold an unnormalized slug, and reverting to any such version restores it unchanged — the invariant the delivery layer and the `(localeCode, slug)` index assume is not enforced on the revert path. Nothing backfills existing slugs either. Also still unimplemented from the report's required work: no redirect is emitted when a published entry's slug changes, so old URLs 404 (which interacts with ADV-02 — redirects would not apply anyway).

**POL-05** is worth doing purely for credibility: `KAST_SECURITY_MODEL.md:121, 830-831, 1216`, `KAST_PRD.md:415` (requirement BR-AUT-001), `PHASE_3_PLAN.md` in four places, and the **public** `security/responsible-disclosure.md:45` all say bcrypt, complete with a `bcrypt.hash(password, 12)` code sample. The implementation is `argon2` (`auth.service.ts:9`, `weak-credential.util.ts:1,94`). The public security page tells a researcher something false about the primary credential control, which undermines every other claim on that page — and BR-AUT-001 mandates the wrong algorithm, so a future contributor could "fix" the code to match the spec.

---

## What I would do next

A realistic sequence. The first block is roughly a week of focused work and closes most of the genuine risk; nothing in it requires an architectural decision.

**Block 1 — cheap, high-value, no decisions required (do these first)**

1. **`SEC-04`** — make the permission matrix diff and call the existing revoke endpoint. A security control that silently fails to revoke is the worst thing on this list per line of code.
2. **`SEC-02`** — apply `isSecretSettingKey` to an object's own keys in `redactObject`, not only to the `{ key, value }` pair shape it already covers. Verified: `{apiKey:'sk-live-…'}` is written to the audit log verbatim today. Two lines, and it stops secrets flowing into a permanent, exportable log.
3. **`SEC-12`** — add `--appendonly yes`, `requirepass`, and drop the published port in both compose files; fix the docs line claiming AOF. Three lines of YAML against silent queue loss and an open Redis.
4. **`SEC-11` + `CLI-A`** — reconcile the storage provider enum: drop `gcs` from the API schema (or warn loudly at boot) and drop `minio` from the CLI (or map it to `s3`). Two one-line changes; one prevents data loss, the other is the first thing every new user hits.
5. **`SEC-19`** — project the delivery menu payload. Same shape as the existing media projection, drops `entryId` and filters `isActive:false`. Add the missing menus e2e case.
6. **`PLG-F`** — add `@sentry/node` to `apps/api` dependencies and log in the catch instead of swallowing. One line plus one line, and it is currently the difference between "Sentry configured" and "no error reporting exists".
7. **`SEC-22`** — `.catch()` on the plugin event handler, and try/catch the per-plugin load loop (the `settings:write` boot crash from `SEC-23`). Two small changes that convert "any plugin can take the API down" into a log line.
8. **`ADV-03` (crash half only)** — either include usages in the media response or make the SDK type honest and guard `file.usages?.length`. The media library currently throws on every file open; the tables can wait.
9. **`SEC-16`** — length-guard before `timingSafeEqual`. One line.
10. **`OPS-01`** — add a Redis health indicator. Small, and it is the signal that makes SEC-13 and SEC-12 detectable rather than silent.

**Block 2 — the honesty pass (small, mostly docs and one UI wiring)**

11. **`ADV-01`** — surface `enforcedBy` through the SDK and admin, and fix the SMTP card's copy. The API already computes the truth; the UI discards it. Silently losing password-reset emails is the highest-consequence lie in the settings screens. Wiring `enforcedBy` also fixes half of `ADV-04`/`ADV-05`.
12. **`CLI-B`** — correct `/mcp` → `/api/v1/mcp` in the CLI output, generated README, root README and four docs pages.
13. **`POL-05`** — bcrypt → Argon2id across the security model, the PRD requirement, the phase plans, and the public disclosure page.
14. **`ADV-08`, `ADV-09`, `ADV-11`, `POL-04`, `POL-06`, `POL-07`** — the batch of small contract and docs corrections. Each is minutes; collectively they are most of what an integrator trips over.

**Block 3 — decide, then build**

15. **`SEC-05` + `SEC-09` together** — wire `scopeValue` into `scopeDataAllows` and ship `scopeData` in the admin dialog. Decide first whether an absent per-type entry denies (safer, breaks existing scoped tokens) or allows. Doing one without the other leaves either an unenforceable dimension or an unreachable UI.
16. **`SEC-13`** — add the reconciliation cron *and* a status guard on `schedulePublish` (or remove the job before re-adding). The cron is far cheaper than an outbox and closes both halves.
17. **`SEC-06`** — decide whether MCP is agent-token-only. Whatever you choose, **`MCP-D` and `MCP-E` should land at the same time** — auditing denials and stamping `agentTokenId`/`agentName` is a handful of lines against columns and indexes that already exist, and it turns the entire MCP surface from invisible to accountable.
18. **`SEC-01` + `SEC-03`** — one piece of work: route plugin config through the same `encryptSecret` path as settings, and make the webhook module read `KAST_SECRET_ENCRYPTION_KEY`. Decide the rotation story once, for both.

**Block 4 — the two structural questions**

19. **MCP.** `MCP-A` is the gate: until the SSE handshake is correct (or the transport is honestly re-declared as Streamable HTTP and the docs follow), the tool set, dry-run parity and scope model are all improvements to something no stock client can reach. Decide transport first, then `MCP-C` (PRD versus implementation as source of truth — note the implementation already has three of four surfaces agreeing, so aligning the PRD is the cheap direction), then `MCP-B` argument validation, then `MCP-F` a conformance test so this never regresses invisibly again.
20. **Plugins.** `PLG-A`, `PLG-B` and `PLG-C` are individually small but collectively decide whether the plugin system is a real product surface or should be documented as first-party-only for now. Making the loader read `isActive` and making uninstall not resurrect an *enabled* plugin are both cheap and worth doing even under the second answer. `PLG-D` (real artifact installation) and `PLG-E` (extension registration) are the large commitment — and `PLG-E` is the single change that would make the R2, Resend, Sentry and Stripe plugins mean anything.

Everything in section 4 and most of the testing items can trail behind this. The two I would not let trail: **`MCP-F`** (a conformance test, because MCP defects are structurally invisible to the current suite) and a **Docker image smoke test** (because `OPS-05` and `PLG-A` are shipping in published images that have never been started).
````

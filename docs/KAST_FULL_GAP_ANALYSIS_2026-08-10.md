# Kast CMS — Full Project Scan and Gap Analysis

**Audit date:** 2026-08-10  
**Repository:** kast  
**Branch reviewed:** main  
**Commit reviewed:** 9e9ab99 — Merge pull request #62  
**Assessment type:** architecture, source, contract, security, delivery, test, documentation, and operational-readiness review  
**Result:** internal alpha / engineering preview; not ready for an untrusted or production deployment

---

## 1. Executive conclusion

Kast is not an empty prototype. It is a substantial, coherent monorepo with a serious product vision, a broad data model, a large NestJS API, a polished Next.js admin, two public frontend starters, an SDK, a plugin SDK, a scaffold CLI, first-party plugin examples, and extensive product documentation. The repository contains roughly 63,000 lines across the main source and architecture-documentation areas. The current workspace can lint, type-check, run its unit tests, and build all 14 packages after generated dependencies and caches are refreshed.

The main problem is not lack of code. The main problem is that several of the strongest product claims are only represented by UI, schema, SDK types, or documentation and are not enforced end to end. In particular:

1. Management content endpoints are public and can return non-published content when a caller supplies a status.
2. API-token scopes are stored but never enforced. Agent tokens are accepted by the global REST guard, so an agent token can call ordinary REST endpoints with its owner's roles.
3. Custom roles and permissions can be created in the database and edited in the admin, but protected routes only check hard-coded system role names. Fine-grained RBAC is therefore not operational.
4. Content entries are arbitrary JSON. Required fields, field types, uniqueness, relation targets, media references, enum choices, min/max settings, defaults, and per-field localization rules are not validated against the selected content type.
5. The documented seed command creates a known super-admin account with a known password.
6. SMTP credentials saved in Global Settings are stored as ordinary JSON and returned to VIEWER-level users.
7. Local media upload writes files but the API does not serve the generated /uploads URLs. Soft-deleting media also deletes the physical object, making restoration impossible.
8. The plugin control plane does not actually install packages, disable loaded code, or include filesystem plugins in the production API image.
9. MCP has 15 tools, but its tool set, token-scope model, auditing, session model, authentication boundary, and SSE transport do not meet the repository's own PRD.
10. Password recovery, invited-user onboarding, OAuth callback routing, and server-side refresh-token logout contain end-to-end breaks in split API/admin deployments.
11. The SDK and admin call several routes or request shapes the API does not implement.
12. Automated coverage is concentrated in 14 API unit suites. There are no admin tests, no plugin tests, no SDK tests, and only two API E2E specifications.

### Release recommendation

Do not expose the current API to the public internet with real editorial data or credentials. It is suitable for continued local development and controlled demonstrations. A production release should be blocked until the P0 security and data-integrity findings in Section 7 are fixed and proven with integration tests.

### Overall maturity score

The following score is a judgment based on implemented behavior, not on the amount of code or the quality of the visual design.

| Area                            |       Score | Interpretation                                                                                      |
| ------------------------------- | ----------: | --------------------------------------------------------------------------------------------------- |
| Product vision and architecture |     4.5 / 5 | Clear, unusually detailed, and internally coherent at the design level                              |
| Database model                  |     4.0 / 5 | Broad model coverage, but migration strategy and several unused fields/models need work             |
| API breadth                     |     3.5 / 5 | 24 controllers and about 140 route handlers; many important happy paths exist                       |
| Admin experience                |     3.5 / 5 | Broad page coverage, strong RTL/theme work, but key flows call incompatible API contracts           |
| Public delivery API             |     3.0 / 5 | Published-content delivery exists, but management endpoints undermine the boundary                  |
| Security and authorization      |     1.5 / 5 | Good primitives exist, but several authorization and secret-handling guarantees are not enforced    |
| Content-model integrity         |     1.0 / 5 | The central schema contract is not applied to entry writes                                          |
| MCP / AI-agent control          |     1.5 / 5 | Demonstrable skeleton and 15 tools, but not the promised safe MCP control plane                     |
| Plugin ecosystem                |     1.5 / 5 | SDK, manifests, loader, and examples exist; lifecycle and production packaging are incomplete       |
| Deployment readiness            |     2.0 / 5 | Images/configs exist and builds pass, but production topology and configuration remain inconsistent |
| Automated verification          |     2.0 / 5 | Useful API unit tests pass; cross-layer, UI, plugin, security, and operational coverage are sparse  |
| Documentation accuracy          |     2.5 / 5 | Very extensive, but many examples and completion claims no longer match the code                    |
| **Overall**                     | **2.4 / 5** | **Strong engineering preview, not production-ready**                                                |

---

## 2. What was reviewed

### 2.1 Repository areas

- Root configuration, README, package manager, Turbo, formatting, lint, release, and CI configuration.
- apps/api: controllers, services, repositories, DTOs, guards, interceptors, queues, workers, Prisma schema, migration, seed, and E2E setup.
- apps/admin: session lifecycle, middleware, route handlers, hooks, pages, content editor, schema builder, settings, media, roles, tokens, plugins, forms, SEO, trash, and queues.
- apps/docs: 78 generated documentation pages and their API/product claims.
- apps/web-blog and apps/web-docs: public delivery starter behavior and build configuration.
- packages/sdk: request paths, response types, binary handling, and API parity.
- packages/plugin-sdk: manifest, hook, permission, and context capabilities.
- packages/create-kast-app: prompts, generated environment, file-copy template, Docker output, and E2E tests.
- plugins: example, Meilisearch, R2, Resend, Sentry, and Stripe packages.
- docs/architecture: vision, PRD, API specification, database schema, security model, development standards, and design system.
- docs/phases and docs/decisions: stated completion criteria, deferred work, and known CLI decisions.
- Docker Compose, Dockerfiles, Railway, Render, Vercel, GitHub Actions, and environment examples.
- Existing running project containers through read-only HTTP and health probes.

### 2.2 Method

The audit combined:

- Static source inspection.
- Route, model, file, and test inventory.
- Cross-layer contract comparison: admin to SDK, SDK to API, API to Prisma, documentation to implementation.
- Threat-oriented inspection of authentication, authorization, secret storage, upload handling, outbound HTTP, audit logging, and plugin execution.
- Non-mutating live API probes.
- Repository-provided format, lint, type-check, unit-test, build, CLI E2E, and production-dependency audit commands.

### 2.3 Limitations

- The API E2E setup intentionally truncates an isolated kast_test database. The running Docker stack contains kast_db but no kast_test database. The audit did not create or mutate a database merely to run the reset-based E2E suite.
- External OAuth providers, SMTP, S3, R2, Meilisearch, Resend, Sentry, and Stripe were not configured with real credentials.
- No penetration test, browser accessibility run, load test, disaster-recovery exercise, or cloud deployment was performed.
- Generated screenshots demonstrate visual breadth; they are not treated as proof that the flows work.
- This is a point-in-time assessment of commit 9e9ab99 and the workspace state on the audit date.

---

## 3. Repository inventory and evidence

### 3.1 Measured size

| Area                                     |             Source files | Approx. lines |
| ---------------------------------------- | -----------------------: | ------------: |
| API source                               |     186 TypeScript files |        14,650 |
| Admin source                             | 187 TypeScript/TSX files |        19,813 |
| Astro documentation source               |  78 content/source files |         7,057 |
| Public blog starter                      |          15 source files |         1,013 |
| Public docs starter                      |          13 source files |           727 |
| SDK                                      |      33 TypeScript files |         2,296 |
| Plugin SDK                               |       3 TypeScript files |            96 |
| create-kast-app source                   |      15 TypeScript files |         1,510 |
| Plugins, including generated build files |                 23 files |         1,873 |
| Architecture, phase, and decision docs   |        14 Markdown files |        14,496 |

Additional counts:

- 38 Prisma models.
- 9 Prisma enums.
- 24 API controllers.
- Approximately 140 HTTP route handlers.
- 14 API unit-spec files.
- 2 API E2E spec files.
- 0 admin test files.
- 0 plugin test files.
- 74 stored UI screenshots.
- 91 Markdown/MDX files across docs and the documentation site.
- 100 unchecked task checkboxes in the root documentation set.
- No TODO/FIXME/HACK markers in application, package, or plugin TypeScript. This is not evidence of completion; the gaps are mostly semantic rather than marked TODOs.

### 3.2 Current package/version picture

The package versions are not presented consistently:

- The root README describes Kast v1.0.2.
- API and admin packages are 0.1.0.
- SDK is 0.3.2.
- Plugin SDK is 0.1.0.
- create-kast-app is 2.1.0.
- Documentation app is 1.0.0.
- The README describes Next.js 15, while the workspace range is Next ^16.2.11 and the installed build is Next 16.3.0.

This makes compatibility, release support, and upgrade responsibility unclear.

---

## 4. Intended product understood from the repository

Kast is intended to be:

- An open-source, self-hosted, headless-first CMS.
- Developer-first, with a typed SDK, REST API, generated app starter, webhooks, plugins, and deploy templates.
- Editor-friendly, with a polished admin for modeling content, editing localized entries, media, SEO, forms, menus, users, roles, settings, audit, trash, and jobs.
- RTL-first, with Arabic support and direction-aware UI.
- SEO-native, including publish gates, metadata, scores, redirects, sitemap, and robots.
- AI-native through a built-in MCP server, scoped agent tokens, dry-run tools, agent sessions, and audit attribution.
- Secure by default, with strict RBAC, encrypted secrets, hashed tokens, safe uploads, rate limits, auditability, and recoverable deletion.
- Extensible through a plugin SDK and first-party adapters for Meilisearch, R2, Resend, Sentry, and Stripe.

The current product is closest to a broad CMS engineering preview. The vision and UI are ahead of the runtime guarantees.

---

## 5. What is present and substantially implemented

This section records real strengths so that remediation work preserves them.

### 5.1 Foundation and architecture

- pnpm/Turbo monorepo with coherent app/package boundaries.
- Strict TypeScript configurations and shared lint/format standards.
- NestJS modular API with global validation, exception normalization, throttling, authentication, role guard, and audit interceptor.
- Prisma/PostgreSQL data model covering content, localization, versions, relations, SEO, users, roles, tokens, media, agents, audit, webhooks, plugins, forms, menus, settings, and future AI jobs.
- BullMQ/Redis infrastructure with workers for webhook, media, SEO, scheduled publishing, email, and trash.
- Detailed architecture, security, API, database, product, phase, and design documents.

### 5.2 Authentication and security primitives

- Argon2id password hashing.
- Short-lived JWT access tokens.
- Opaque refresh tokens stored as hashes.
- API and agent tokens shown once and stored as hashes.
- Password reset tokens stored as hashes and time limited.
- Rate limits on login, setup, password reset, form submission, and the global API.
- Helmet headers, HSTS, referrer policy, MIME sniffing protection, and a CSP baseline.
- Global DTO whitelist with unknown-field rejection.
- Webhook HMAC signing and encrypted webhook secrets.
- Media URL-fetch SSRF guard with DNS/private-address checks and redirect revalidation.
- File MIME allow-list, magic-byte validation, and rich-text sanitization utility.
- Audit redaction utility for common secret names.

### 5.3 CMS capabilities

- Content-type CRUD and field CRUD.
- Content-entry CRUD with draft, published, archived, scheduled, and trashed states.
- Published-content delivery API separated from management routes.
- Multi-locale entry rows, locale fallback chain, and locale administration.
- Version snapshots, version listing, version detail, and revert.
- SEO metadata, scores/issues, redirect CRUD and CSV paths, sitemap generation, and publish gating.
- Media folders, direct upload, upload from URL, metadata editing, Sharp WebP optimization, and thumbnail jobs.
- Forms, form builder, public submission endpoint, submission list, delete, and CSV export.
- Menus and nested menu items.
- Users, roles, API tokens, agent tokens, audit browser, trash browser, plugin pages, global settings, dashboard, and queue monitor.
- Dedicated public blog and public documentation starters consuming Kast.

### 5.4 Admin and documentation

- Broad admin route coverage with approximately 37 page files.
- Light/dark themes, Arabic locale, RTL layouts, and 74 screenshot artifacts.
- Rich-text editor, field-type configuration UI, content list/editor, media library, form/menu builders, SEO views, and operational screens.
- Documentation site successfully builds 78 pages with search indexing.

### 5.5 Verification that passed

- pnpm lint: passed after Prisma client generation.
- pnpm typecheck: passed after Prisma and Next route-type generation.
- pnpm test: 14 suites passed; 170 tests passed.
- create-kast-app E2E: 7 tests passed.
- pnpm build: all 14 packages passed after a frozen install and generated-cache refresh.
- Live GET /api/v1/health: HTTP 200 with database up.

---

## 6. Severity model

| Severity                 | Meaning                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0 — release blocker** | Security boundary failure, credential/secret exposure, broad authorization bypass, or central data-integrity failure. Must be fixed before any production exposure. |
| **P1 — high**            | A primary advertised workflow is broken, misleading, unsafe, or not deployable end to end. Must be fixed for a credible beta.                                       |
| **P2 — medium**          | Important correctness, operability, maintainability, or contract problem. Should be fixed before general availability.                                              |
| **P3 — low / polish**    | Cleanup, clarity, compatibility warning, or deferred improvement with limited immediate impact.                                                                     |

---

## 7. P0 release blockers

### P0-01 — Public management endpoints expose more than published delivery data

**Classification:** found, implemented incorrectly  
**Evidence:** apps/api/src/modules/content/content.controller.ts, content.repository.ts, content-types.controller.ts, and media.controller.ts.

The management list and detail routes for entries are marked Public. List accepts DRAFT, SCHEDULED, ARCHIVED, and PUBLISHED status filters. Detail lookup uses only the entry ID and does not exclude trashed entries. Content-type list/detail and media list/detail are also public.

The live stack confirmed:

- GET /api/v1/content-types returned HTTP 200 without authentication and exposed full field schemas.
- GET /api/v1/content-types/blog-post/entries?status=DRAFT returned HTTP 200 without authentication.
- GET /api/v1/content-types/blog-post/entries?status=SCHEDULED returned HTTP 200 without authentication.
- GET /api/v1/media returned HTTP 200 without authentication.
- GET /api/v1/settings correctly returned HTTP 401, showing that this is route policy rather than a failed global guard.

**Impact:** unpublished editorial work, scheduled campaigns, archived data, author IDs, internal schema, and trashed entries can be enumerated or retrieved. The dedicated delivery service's published-only checks are bypassed.

**Required correction:**

1. Remove Public from management controllers.
2. Keep public reads only under /api/v1/delivery.
3. Add published-only public content-type/schema endpoints only if explicitly required.
4. Add tests proving DRAFT, SCHEDULED, ARCHIVED, and TRASHED content cannot be obtained anonymously.

**Acceptance:** anonymous requests to every management content/media route return 401; delivery routes return only published, non-trashed content.

### P0-02 — API-token scope is stored but not enforced

**Classification:** found, not completed  
**Evidence:** apps/api/src/modules/auth/strategies/api-token.strategy.ts and apps/api/src/modules/tokens.

ApiToken records support FULL_ACCESS, READ_ONLY, and SCOPED with scopeData. The authentication strategy discards scope and scopeData and returns the owning user's full roles. No global or route guard evaluates the token scope.

**Impact:** a token presented to a user as read-only or narrowly scoped can perform every mutation permitted by the owner's roles. This is a direct authorization bypass and a dangerous false-security signal.

**Required correction:**

- Add token scope data to AuthUser.
- Define canonical resource/action permissions.
- Enforce READ_ONLY against all mutating methods.
- Enforce SCOPED at route/resource level, including content-type and record scope.
- Deny by default when a new route has no mapping.
- Add an authorization matrix E2E suite.

**Acceptance:** a READ_ONLY token cannot POST/PATCH/DELETE; a scoped content token cannot access users, settings, plugins, or another content type.

### P0-03 — Agent tokens can escape MCP scopes through ordinary REST endpoints

**Classification:** found, implemented incorrectly  
**Evidence:** apps/api/src/common/guards/jwt-auth.guard.ts and agent-tokens/strategies/agent-token.strategy.ts.

The global authentication guard accepts jwt, api-token, and agent-token for all protected routes. Agent-token authentication returns the owning user's system roles. MCP tool scopes are checked inside MCP service only; ordinary REST controllers never check agentTokenScopes.

**Impact:** an agent token allowed to call one harmless MCP tool can directly call protected REST APIs using the owner's roles. Revocable tool-level control is not a real boundary.

**Required correction:**

- Restrict agent-token authentication to the MCP transport, or add a global policy that rejects agent tokens on non-MCP controllers.
- Bind each token to explicit resources/actions if REST use is intended.
- Add negative tests for settings, user, role, token, plugin, media, and content mutations.

**Acceptance:** an MCP-only agent token receives 401/403 on every non-MCP management endpoint.

### P0-04 — Custom RBAC permissions are decorative

**Classification:** found, not completed  
**Evidence:** apps/api/src/common/guards/roles.guard.ts and apps/api/src/modules/roles.

The roles module stores Permission and RolePermission records, exposes CRUD, and powers an admin permission matrix. The global RolesGuard only compares literal role names from the Roles decorator. There is no RequirePermission decorator, permission guard, row scope, field scope, or content-type scope enforcement.

A user with only a custom role cannot satisfy routes that require editor/admin system role names, regardless of the permissions assigned in the UI. Conversely, stored permission rows do not constrain a system role.

**Impact:** the advertised fine-grained RBAC model does not work and administrators can make policy changes that have no runtime effect.

**Required correction:**

- Choose and document one authorization model.
- Add permission metadata to every protected operation.
- Resolve effective permissions from roles with wildcard and scoped matching.
- Preserve a narrow, audited super-admin bypass.
- Seed canonical permission definitions.
- Test every role/resource/action combination, including ownership and content-type scope.

**Acceptance:** custom roles can use exactly their assigned operations and cannot use any unassigned operation.

### P0-05 — Known production-capable super-admin credential

**Classification:** found, unsafe default  
**Evidence:** apps/api/prisma/seed.ts, API E2E seed, and root README quick-start instructions.

The normal seed creates admin@kast.local with password Admin1234! and the super_admin role. The README instructs users to run db:seed.

**Impact:** any deployment that follows the documented seed workflow can expose a known privileged credential.

**Required correction:**

- Never create a fixed privileged password outside isolated tests.
- Make first-owner creation use the setup route with a database-level single-owner lock.
- If a seed account is needed, require explicit environment values and refuse production.
- Print a one-time generated secret only to an interactive local terminal if absolutely necessary.
- Add a startup warning/refusal for known test credentials.

**Acceptance:** production seed cannot create a known login, and the documented quick start never asks users to deploy one.

### P0-06 — SMTP secrets are stored as ordinary settings and returned to VIEWER

**Classification:** found, implemented incorrectly  
**Evidence:** apps/api/src/modules/settings and apps/admin/src/components/settings/email-tab.tsx.

The admin stores smtp.password in GlobalSetting.value. SettingsRepository performs no encryption or redaction. GET /settings allows VIEWER, EDITOR, ADMIN, and SUPER_ADMIN and returns every GlobalSetting row. The UI text says the password is write-only and never returned, but the API contradicts it. PluginConfig.data has the same at-rest problem for plugin secrets.

**Impact:** low-privilege authenticated users can retrieve SMTP credentials. Database readers/backups also contain plaintext service credentials.

**Required correction:**

- Move secrets to environment/secret-manager bindings or encrypt them with a distinct application encryption key.
- Separate public/non-secret settings from privileged secret configuration.
- Return configured: true/false or a masked value, never the secret.
- Restrict secret configuration to super-admin.
- Rotate any credentials already stored.

**Acceptance:** no API response, log, audit row, database JSON value, or backup contains plaintext SMTP/plugin credentials.

### P0-07 — Content-type schemas are not enforced on entry data

**Classification:** central capability missing  
**Evidence:** apps/api/src/modules/content/content.service.ts and dto/content-entry.dto.ts.

Create and update accept data as Record<string, unknown>. The service discovers rich-text fields only to sanitize them. It does not enforce:

- known field names;
- required fields;
- TEXT, RICH_TEXT, NUMBER, BOOLEAN, DATE, JSON, ENUM, MEDIA, RELATION, or UID types;
- isUnique;
- min/max, length, regex, integer, enum choices, or allowed MIME configuration;
- defaultValue;
- relation target existence/type;
- media existence;
- field-level localization;
- slug/UID rules;
- immutable or hidden fields.

**Impact:** Kast's central promise—content governed by a model—is not true at runtime. Invalid data can be stored, published, delivered, indexed, and consumed by frontends.

**Required correction:**

- Build a schema compiler/cache from ContentField definitions.
- Validate and normalize every create, update, locale add, version revert, MCP write, import, and plugin write.
- Enforce uniqueness transactionally in the database or a normalized uniqueness table.
- Provide field-specific validation errors.
- Add property-based and integration tests across all field types.

**Acceptance:** invalid field data cannot enter by REST, MCP, SDK, admin, import, version restore, or plugin path.

### P0-08 — Webhook delivery permits server-side request forgery

**Classification:** found, missing security control  
**Evidence:** apps/api/src/modules/webhook/dto/webhook.dto.ts and webhook.processor.ts.

Webhook URLs only use IsUrl with require_tld false. The worker sends requests to the stored URL without DNS or private-network checks. The project already contains an SSRF guard for remote media, but it is not reused here.

**Impact:** a user able to configure webhooks can make the API call loopback, private services, cluster endpoints, or cloud metadata services. Redirects may widen the attack.

**Required correction:**

- Reuse a shared outbound URL policy.
- Block loopback, link-local, RFC1918/private, metadata, Unix socket, and non-HTTP(S) targets.
- Resolve and pin public IPs safely, and revalidate every redirect.
- Add an explicit opt-in allow-list for self-hosters who need internal webhooks.
- Bound response bytes.

**Acceptance:** private/internal targets and redirects are rejected before any network connection.

### P0-09 — Entry operations do not bind the entry ID to the route's content type

**Classification:** found, implemented incorrectly  
**Evidence:** ContentService findOne/update/trash/publish/etc. and ContentRepository.findById.

The service verifies that the typeSlug exists, then loads the entry by ID only. It never checks entry.contentTypeId against the resolved type. A caller can put an entry ID from type B under a route for type A and read or mutate it. Events and plugin indexing then use the caller-provided typeSlug.

**Impact:** type boundaries, future content-type-scoped permissions, webhooks, indexing, and audit resource identity can be bypassed or corrupted.

**Required correction:** query by id plus contentTypeId for every entry/version/state operation and return 404 on mismatch.

**Acceptance:** an entry ID is unusable under any other content-type slug.

---

## 8. High-priority capabilities that exist but are incomplete

### 8.1 Authentication, onboarding, and session lifecycle

| ID      | Gap                                            | Evidence and impact                                                                                                                                                                         | Required work                                                                                                                                |
| ------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-01 | First-owner setup race                         | createInitialOwner checks user count inside a default transaction, but concurrent requests can both see zero and create super-admins. The comment overstates protection.                    | Use serializable isolation, an advisory lock, or a singleton installation row; add concurrent E2E test.                                      |
| AUTH-02 | Forgot/reset pages blocked by admin middleware | PUBLIC_PATHS contains only /login and /setup. Unauthenticated /forgot-password, /reset-password, and /oauth-callback requests are redirected to login.                                      | Mark all recovery/OAuth callback routes public and add middleware tests.                                                                     |
| AUTH-03 | Password links target the wrong origin         | EmailProcessor builds links from SITE_URL. In a split deployment that is the API/public site, not ADMIN_URL or the admin base path.                                                         | Introduce a validated ADMIN_PUBLIC_URL and central route builder.                                                                            |
| AUTH-04 | OAuth callback uses API-relative redirect      | API redirects to /oauth-callback on its own origin and places access and refresh tokens in the query string.                                                                                | Redirect to the validated admin origin; use a short-lived one-time authorization code, never refresh tokens in URLs.                         |
| AUTH-05 | Invited users cannot establish a password      | UsersService creates a passwordless user and queues user-invite without a token. Email falls back to /login. No accept-invite admin page exists.                                            | Create hashed invite tokens, expiry, accept-invite route/page, password setup, and resend/revoke flows.                                      |
| AUTH-06 | Admin logout does not revoke server token      | Admin /api/auth/logout calls the protected API logout endpoint without Authorization. The API returns 401; the cookie is cleared locally but the refresh token remains valid.               | Make refresh-token logout safely public or pass a valid access credential; test revocation.                                                  |
| AUTH-07 | Password-reset use is not atomic               | resetPassword finds a valid token, then marks it used and updates password in parallel. Concurrent requests can pass the initial check.                                                     | Consume token conditionally in one transaction, then update password/revoke sessions.                                                        |
| AUTH-08 | Session profile is incomplete                  | Admin rebuilds the user from JWT claims, but access tokens contain only sub, email, roles. firstName and lastName remain null even though TokenPair includes user.                          | Use pair.user or include necessary non-sensitive claims.                                                                                     |
| AUTH-09 | Hooks retain expired API clients               | Several hooks create a client from session.accessToken but memoize callbacks without client/token dependencies. They continue using an old token after the 15-minute access-token rotation. | Memoize client by token and include it in callback dependencies, or provide one session-aware client with refresh/retry behavior.            |
| AUTH-10 | OAuth auto-provisioning is permissive          | A new OAuth identity with any provider-returned email is auto-created with the default role.                                                                                                | Make this an explicit installation policy; support domain allow-list, verified-email requirement, and disabled-by-default self-registration. |

### 8.2 Content types, entries, delivery, and versions

| ID     | Gap                                        | Evidence and impact                                                                                                                                                                    | Required work                                                                                                     |
| ------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| CON-01 | Field configuration cannot be saved        | Admin/SDK send isHidden, config, and defaultValue. API CreateFieldDto/UpdateFieldDto omit them and the global pipe rejects unknown fields.                                             | Align DTO, Prisma writes, SDK types, admin form, and tests.                                                       |
| CON-02 | Field reordering route is missing          | SDK/admin call PATCH /content-types/:name/fields/reorder; the controller has no route. Drag reorder fails/reverts.                                                                     | Implement transactional reorder or remove the UI until supported.                                                 |
| CON-03 | Bulk entry routes are missing              | SDK/admin call bulk/trash, bulk/publish, and bulk/unpublish; API has only single-entry operations.                                                                                     | Implement bulk endpoints with per-item authorization, SEO results, atomicity policy, and audit.                   |
| CON-04 | Slug handling is implicit and weak         | Create takes data.slug by cast or generates timestamp slug. Update cannot explicitly update the locale slug.                                                                           | Define UID/slug field behavior, normalization, uniqueness, locale scope, and redirects on change.                 |
| CON-05 | Version numbering races                    | Latest version number is read then incremented in application code. Concurrent updates can collide.                                                                                    | Allocate version number transactionally or through a database sequence/lock.                                      |
| CON-06 | Version retention settings are inert       | Admin exposes retention controls but the runtime does not consume them.                                                                                                                | Add retention policy and scheduled pruning with protected minimum history.                                        |
| CON-07 | Scheduled publication is not atomic        | Queue add and database status update are separate. Partial failure can leave an orphan job or a scheduled record without a job.                                                        | Use an outbox/reconciliation strategy and idempotent worker.                                                      |
| CON-08 | Restore naming is ambiguous                | Entry /restore changes ARCHIVED to DRAFT, while trash restoration lives in another module.                                                                                             | Separate unarchive from trash restore and align names/docs/SDK.                                                   |
| CON-09 | Public delivery schema discovery is absent | Frontend schema access is currently achieved through public management content-type routes.                                                                                            | Add an intentional read-only delivery schema endpoint with only safe fields.                                      |
| CON-10 | AI generation models are unused            | AiContentGeneration and AiImageGeneration are in the v1 schema, but no service, controller, worker, provider, SDK, or admin feature uses them. The architecture marks most of this v2. | Keep clearly deferred or remove from near-term claims; add only with privacy, cost, quota, and provider controls. |
| CON-11 | Content-type localization is not writable  | ContentType has isLocalized and ContentService relies on it, but content-type create/update DTOs omit it. Ordinary API/admin creation leaves it false.                                 | Add the flag to the contract/UI, or derive localization from fields and remove the duplicate switch.              |
| CON-12 | Relation and media-usage rows are unused   | ContentRelation and MediaUsage exist in Prisma, but application source has no read/write path for either. Relation fields remain JSON and media usage cannot be trusted.               | Maintain normalized relation/usage rows during content write, locale update, revert, trash, and purge.            |

### 8.3 Media and storage

| ID     | Gap                                                  | Evidence and impact                                                                                                                         | Required work                                                                            |
| ------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| MED-01 | Local files are never served                         | LocalStorageAdapter returns http://localhost:3000/uploads/key, but no static assets middleware or authenticated download controller exists. | Serve a hardened upload directory or use object storage; test URL access in Docker.      |
| MED-02 | Soft delete destroys the object                      | MediaService.delete deletes storage first and then soft-deletes the row. Trash restore only clears deletion state.                          | Retain objects until permanent purge; restore metadata and object together.              |
| MED-03 | Provider recorded as local                           | Upload and URL upload persist provider: local even when S3/R2 adapter is active.                                                            | Add provider identity to the adapter and persist it.                                     |
| MED-04 | Memory upload limit is applied too late              | Multer memoryStorage has no upstream fileSize limit. The full request buffer is allocated before service validation.                        | Configure Multer/HTTP body limits from validated env and stream large uploads.           |
| MED-05 | Optimizer leaves originals orphaned                  | WebP optimization updates storageKey to the WebP result but does not delete or reference the original.                                      | Define original-retention policy and track variants explicitly.                          |
| MED-06 | Thumbnails are not represented                       | Thumbnail objects are uploaded but have no MediaVariant rows/URLs and no cleanup lifecycle.                                                 | Add a variant model or structured metadata and serve/select/delete variants.             |
| MED-07 | GCS is accepted but not implemented                  | Env accepts gcs, module falls back to local. CLI/admin offer minio, but API env rejects minio.                                              | Implement adapters or remove options; conditionally validate credentials.                |
| MED-08 | SVG safety is incomplete                             | SVG is enabled by default and accepted as an image; there is no SVG sanitizer or forced download policy.                                    | Sanitize/rewrite SVG, serve with safe CSP/content disposition, or disable it by default. |
| MED-09 | Settings do not control media runtime                | storage provider, limits, quality, thumbnails, and related admin settings are not consumed by adapters/workers.                             | Choose env-only versus dynamic settings and make UI truthful.                            |
| MED-10 | Permanent deletion does not document variant cleanup | Trash purge deletes DB records but the physical-object/variant lifecycle is incomplete.                                                     | Add idempotent storage cleanup with retries and orphan reconciliation.                   |

### 8.4 Settings and operational configuration

The Settings UI is much broader than the runtime:

- Storage settings are not used by MediaModule, which selects its adapter at startup from environment.
- EmailProcessor reads environment at startup, while only the SMTP test reads database settings.
- CORS is configured at bootstrap from environment, not from saved security settings.
- robots.txt is hardcoded Allow: /.
- SEO defaults are not consumed by SeoService.
- Default content status is not consumed on creation.
- Version retention is not consumed.
- Media quality and automatic-thumbnail settings are not consumed.
- testStorage returns configured without connecting, listing, writing, or deleting a probe object.
- Newly upserted settings default to non-public because the patch DTO cannot set isPublic.

**Recommendation:** separate immutable deployment configuration from dynamic content settings. Do not display a setting as active unless the consuming service reads it and a test proves the effect.

### 8.5 SEO

| ID     | Gap                                            | Evidence and impact                                                                                                                                         | Required work                                                                           |
| ------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| SEO-01 | Body analysis receives the field map           | SeoService passes locale.data to body checks as though it were one ProseMirror document. Normal data is a map of fields, so body length/headings are wrong. | Select configured rich-text fields and combine/analyze their document trees correctly.  |
| SEO-02 | Validation may not persist a score             | If SeoMeta does not exist, validateNow computes a result but does not persist through the normal score path; getScore can remain 404.                       | Make validation idempotently create/update SEO metadata and score records.              |
| SEO-03 | Publish gate applies page SEO universally      | Missing SEO title can block publishing any content type, including taxonomy or non-page records.                                                            | Add per-content-type SEO enablement and configurable blocking policy.                   |
| SEO-04 | Saved SEO defaults are inert                   | Global fallback title/description and robots settings are not consumed.                                                                                     | Wire settings or remove the controls.                                                   |
| SEO-05 | Redirect middleware is on the API process      | In normal headless/split-origin deployment, frontend navigation never passes through the API middleware, so redirects do not affect public pages.           | Implement redirects in delivery/frontends or publish a redirect lookup/export contract. |
| SEO-06 | Redirect targets allow arbitrary external URLs | This may create an open redirect if public routing uses it.                                                                                                 | Define internal-only versus external redirects and require explicit policy.             |
| SEO-07 | Documentation sitemap warning                  | Astro docs build skips its sitemap because astro.config has no site value.                                                                                  | Set the canonical documentation site URL per deployment.                                |

### 8.6 Forms

| ID      | Gap                                             | Evidence and impact                                                                                                                                                    | Required work                                                               |
| ------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| FORM-01 | Submission schema is not enforced               | Submit accepts arbitrary data and never validates required/type/config against FormField.                                                                              | Compile and enforce form schema; reject unknown fields and invalid choices. |
| FORM-02 | Notification email is unused                    | notifyEmail is stored but submission never enqueues a notification.                                                                                                    | Add opt-in templates, retry, privacy controls, and tests.                   |
| FORM-03 | Read state is unused                            | FormSubmission has isRead/readAt but no mark-read endpoint or admin action.                                                                                            | Implement or remove the fields/claim.                                       |
| FORM-04 | Docs use the wrong request/response             | Docs submit raw fields, lowercase types, key/required names, 201, and a submission ID. API requires data wrapper, enum values, name/isRequired, returns 200 {ok:true}. | Make OpenAPI authoritative and repair docs/SDK/examples.                    |
| FORM-05 | SDK submit envelope is wrong                    | SDK promises ApiResponse<{ok}>, API returns bare {ok}.                                                                                                                 | Align response shape.                                                       |
| FORM-06 | SDK CSV uses JSON request path                  | FormsResource.exportCsv calls request rather than requestBlob.                                                                                                         | Use binary/blob handling and test content type/download.                    |
| FORM-07 | IP attribution trusts forwarded header          | x-forwarded-for is accepted without an explicit trusted-proxy policy.                                                                                                  | Configure proxy trust and use the framework's trusted client IP.            |
| FORM-08 | Delete is soft but trash behavior is incomplete | Forms enter trash but scheduled permanent purge does not cover forms.                                                                                                  | Complete the form trash lifecycle and retention tests.                      |

### 8.7 Webhooks

Strengths include encrypted HMAC secrets, signed payloads, retry/backoff, delivery records, timeout, and manual redelivery.

Remaining gaps:

- Response bodies are read without a byte limit and stored in the database.
- Delivery listing is capped rather than properly paginated.
- user.created is supported by the listener, but user invitation/creation does not emit it.
- media.deleted and several documented lifecycle events are absent.
- Event payloads are not versioned.
- Secret encryption reuses JWT_SECRET instead of a separate encryption key, making rotation and key separation difficult.
- There is no dead-letter operational workflow beyond BullMQ failure state.
- Test delivery can still target unsafe URLs until SSRF controls are added.

### 8.8 Trash, recovery, and retention

| ID       | Gap                                   | Evidence and impact                                                                                                     | Required work                                                                            |
| -------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| TRASH-01 | Purge covers only content and media   | User and form records advertised as recoverable are never included in scheduled purge.                                  | Implement a model registry and retention policy for every trashable type.                |
| TRASH-02 | Cross-model pagination is not real    | Each model is fetched independently, concatenated, then sliced; content can dominate and cursor applies inconsistently. | Use a unified trash index/query or stable composite cursor.                              |
| TRASH-03 | Actor attribution is inconsistent     | User trash records actor; content/media/form paths do not consistently set trashedByUserId.                             | Pass CurrentUser through all delete paths.                                               |
| TRASH-04 | Restored user remains inactive        | Restoring clears trashedAt but can leave isActive false.                                                                | Define and test restore/reactivation semantics.                                          |
| TRASH-05 | Physical dependencies may block purge | Foreign keys and storage cleanup are not handled as one idempotent workflow.                                            | Add dependency preview, explicit cascade policy, retries, and operator-visible failures. |

### 8.9 Audit logging

The interceptor records successful mutations and redacts common secret keys, which is a useful baseline. It does not yet satisfy the PRD:

- before is the incoming request body, not the previous persisted resource.
- after is the response, so it is not a normalized diff.
- denied and failed attempts are not logged.
- fire-and-forget Prisma writes can be lost during crash and are not transactionally coupled to the mutation.
- agent attribution is incomplete for MCP calls.
- dry-run audit semantics are incomplete.
- the kast.audit queue is registered and displayed but has no producer/processor path.
- action/resource derivation from HTTP method/path is too generic for a reliable compliance log.

### 8.10 Queues and health

- Seven queues are registered, although the PRD says six and elsewhere includes trash as an extra.
- Six processors exist; kast.audit has no processor.
- Redis persistence in Docker Compose uses a volume but does not enable AOF, despite phase risk notes.
- Health checks only PostgreSQL. Redis, workers, storage, plugin state, and queue backlog are invisible.
- Scheduled publishing relies on Redis delayed jobs without a database reconciliation scheduler.
- Queue dashboard authentication puts its token in a query/cookie flow that should be reviewed for URL/history/log leakage.
- There is no documented dead-letter, replay, idempotency, or backlog-alert operating procedure.

---

## 9. MCP and AI-agent gap analysis

### 9.1 What exists

- Agent-token model, creation, listing, revocation, hashing, and last-used timestamp.
- JSON-RPC controller and SSE endpoint.
- Registry and exactly 15 registered tools.
- Content-type, content-entry, media, SEO, and audit service integrations.
- Dry-run branches on some mutation tools.
- AgentSession and AuditLog schema support.
- Admin pages and documentation.

### 9.2 What is incomplete or inconsistent

| ID     | Gap                                                          | Consequence                                                                                                                                          |
| ------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| MCP-01 | Tool inventory does not match the PRD                        | Required unpublish, add-field, plugin control, media upload, redirect create, and user create tools are absent; several list/get tools replace them. |
| MCP-02 | MCP controller accepts JWT/API token as well as agent token  | The promised agent-specific security and attribution boundary is optional.                                                                           |
| MCP-03 | Scope format is exact tool-name strings                      | PRD/security docs describe resource/action JSON scopes. CreateAgentTokenDto accepts arbitrary strings without a registry allow-list.                 |
| MCP-04 | Tool arguments are not runtime-validated against inputSchema | Handlers cast unknown values; malformed or unexpected values can reach services.                                                                     |
| MCP-05 | Denied calls are not audited                                 | Role/scope rejection happens before the audit path.                                                                                                  |
| MCP-06 | Agent audit attribution is incomplete                        | MCP calls pass userId but not consistently agentTokenId/name, contradicting the audit acceptance criteria.                                           |
| MCP-07 | Session model is one row per successful tool call            | startedAt/endedAt describe a call, not a connection/session. Reads and failures are not represented consistently.                                    |
| MCP-08 | SSE state is process-local                                   | Sessions disappear on restart and cannot span multiple API replicas.                                                                                 |
| MCP-09 | SSE and POST are not bound into one transport session        | The welcome event exposes an ID, but POST RPC does not use it to route responses through the SSE session.                                            |
| MCP-10 | No heartbeat/backpressure/session expiry                     | Dead connections and resource usage are not managed.                                                                                                 |
| MCP-11 | Current protocol compatibility is unproven                   | There is no conformance/integration test with a real MCP client in CI.                                                                               |
| MCP-12 | Dry-run is not universal                                     | The vision says every operation supports it; only selected handlers implement preview behavior.                                                      |

### 9.3 Required MCP completion criteria

1. Select a supported MCP transport/version and implement it with the official protocol SDK where practical.
2. Require agent-token authentication at MCP boundaries.
3. Validate token scopes at connection and tool invocation.
4. Validate every argument with a shared schema.
5. Map tools to the same authorization service used by REST.
6. Record success, failure, denial, dry-run, latency, agent token, user owner, tool, and session.
7. Define true session start/end and make state multi-instance safe, or explicitly use stateless Streamable HTTP.
8. Add conformance tests with at least two real MCP clients.
9. Reconcile the promised 15-tool list across PRD, docs, code, and admin scope selector.

---

## 10. Plugin and integration gap analysis

### 10.1 Plugin control plane

| ID      | Gap                                       | Evidence and consequence                                                                                                                                    |
| ------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PLUG-01 | Install only inserts a database row       | No npm install, artifact download, signature/integrity verification, copy, or load occurs.                                                                  |
| PLUG-02 | Disable does not stop code                | Loader scans the filesystem at every bootstrap, ignores database isActive, calls onLoad, and upserts active state. A disabled plugin returns after restart. |
| PLUG-03 | Uninstall only deletes metadata           | Files and executing listeners remain.                                                                                                                       |
| PLUG-04 | Production image does not contain plugins | API Docker runner copies the deployed API bundle and dist. Loader resolves /plugins in the container, but no /plugins directory is copied.                  |
| PLUG-05 | Manifest permissions are not a sandbox    | The allow-list checks declared strings, but plugin code executes in-process with Node filesystem, process environment, network, and require/import access.  |
| PLUG-06 | Plugin config is plaintext                | PluginConfig.data has no field-level secret encryption/redaction.                                                                                           |
| PLUG-07 | Event handler errors are detached         | buildContext invokes handlers with void and no central error/retry/isolation policy.                                                                        |
| PLUG-08 | Admin pages are declarative only          | Manifest adminPages do not dynamically mount packaged UI. First-party integration screens are not supplied through the extension contract.                  |

### 10.2 First-party plugins

**Meilisearch**

- Indexing is implemented for published/update/trash/unpublish hooks.
- Because plugin context has no content accessor, it fetches the entry over the accidentally public management endpoint.
- Default KAST_API_URL is http://localhost:3001, normally the admin port, not API port 3000.
- Plugin indexes per type as kast\_<type>. SearchController uses kast_content when no type is supplied, but the plugin never creates that aggregate index.
- Public search input has no DTO validation; NaN/negative/missing values are not handled robustly.

**R2**

- A usable adapter class exists inside the plugin.
- Plugin context has no registerStorage extension, so the plugin cannot become the media backend.
- Core has a separate R2 adapter selected by environment, making the plugin mostly informational.

**Resend**

- A usable sendEmail method exists.
- Plugin context has no mail-transport registration.
- Core EmailProcessor independently reads Resend environment variables, so the plugin is not the active integration boundary.

**Sentry**

- Plugin initializes Sentry and exposes capture methods.
- It cannot register request error hooks.
- API bootstrap separately attempts an optional @sentry/node import even though API package does not directly own that dependency in the production deploy subgraph.

**Stripe**

- Outbound product sync logic is meaningful.
- It fetches content through the public management route and defaults KAST_API_URL to port 3001.
- Plugin handleWebhook and checkout methods are not mounted by the plugin system.
- Core StripeController verifies/emits events independently; it is not wired to the plugin's dispatch method.
- Core manual HMAC parsing should safely handle malformed signature lengths; timingSafeEqual can otherwise throw instead of returning a clean 400.

### 10.3 Recommended plugin direction

For a near-term beta, treat plugins as trusted, restart-required, filesystem extensions and state that clearly. Implement database enablement before load, production packaging, lifecycle cleanup, config schema/redaction, and extension registration. Do not claim sandboxing until plugins run behind a genuine process/worker/permission boundary.

---

## 11. SDK and admin contract gaps

### 11.1 Confirmed incompatible calls

| Caller                              | Expected contract                                     | Actual API                                            |
| ----------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| SDK/admin bulk content actions      | POST entries/bulk/trash, bulk/publish, bulk/unpublish | No routes                                             |
| SDK/admin field reorder             | PATCH fields/reorder                                  | No route                                              |
| Field drawer                        | isHidden, config, defaultValue accepted               | DTO rejects these fields                              |
| SDK forms exportCsv                 | Blob/binary response                                  | Uses generic JSON request parser                      |
| SDK form submit                     | ApiResponse envelope                                  | API returns bare {ok:true}                            |
| SDK content publish                 | Ability to pass force for warnings                    | SDK method sends no body                              |
| SDK content types/content summaries | Several flat typed shapes                             | API often returns Prisma rows with locales arrays     |
| Agent token created type            | Flat token summary                                    | API returns data containing token plus nested record  |
| Auth SDK                            | Complete setup/logout/profile contract                | Only partial auth methods; response types are unknown |

### 11.2 SDK architecture gaps

- Types are hand-maintained rather than generated from the Nest OpenAPI document.
- The phase plan mentions swagger:export and types:generate, but those scripts do not exist.
- No SDK unit, integration, contract, or browser tests exist.
- Generic request handling is used for JSON, text, and binary cases inconsistently.
- URL path parameters are not encoded consistently across resources.
- Public delivery endpoints are not represented as a clear first-class SDK resource.
- API errors are normalized at runtime but not exposed as a strong typed error model.

### 11.3 Admin runtime gaps

- Several hooks capture a token-specific client in callbacks that do not depend on the token/client. Long-lived pages can fail after token refresh.
- Middleware checks only refresh-cookie presence, not validity; invalid sessions render a loading/redirect cycle.
- OAuth callback and password recovery routes are incorrectly protected by middleware.
- Settings labels promise effects the API does not apply.
- Bulk content buttons and field drag/drop target missing API routes.
- Queue iframe/auth behavior needs a real deployment test under the admin base path and distinct origins.
- No component, hook, route, accessibility, or browser E2E tests exist.

---

## 12. CLI and generated-project gaps

### 12.1 What works

- CLI builds.
- Seven filesystem/scaffold smoke tests pass.
- Generated projects receive a unique JWT secret.
- Core root files, API/admin/SDK/plugin SDK, Docker Compose, and environment files are copied.
- Existing target directories are refused.

### 12.2 What is incomplete

| ID     | Gap                                                | Consequence                                                                                                                     |
| ------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| CLI-01 | Template is a forked copy of the monorepo          | It has drifted from current API/admin/SDK behavior and security fixes. Generated users do not receive the audited source.       |
| CLI-02 | Plugin selections mostly add environment variables | They do not install/copy/register the selected plugin.                                                                          |
| CLI-03 | Frontend selection does not scaffold source        | It references external GHCR web images rather than generating the selected starter in the project.                              |
| CLI-04 | Locale choices are not applied                     | Prompt choices do not drive seed/default locale/content configuration.                                                          |
| CLI-05 | MinIO option is invalid                            | CLI/admin emit minio; API env schema rejects it and falls back nowhere.                                                         |
| CLI-06 | MCP URL is misleading                              | Success/docs advertise /mcp, while versioned Nest routes are /api/v1/mcp and /api/v1/mcp/sse.                                   |
| CLI-07 | Tests are shallow                                  | Tests check file presence and a few strings, not install, Prisma generation, typecheck, build, migrate, boot, health, or login. |
| CLI-08 | Root setup.sh is obsolete and risky                | It initializes Git, sets a remote, commits, and pushes; it is unrelated to normal project setup and easy to run accidentally.   |

### 12.3 Required scaffold acceptance test

CI should generate each supported project mode in a temporary directory, perform a frozen install, generate Prisma, build, start Postgres/Redis, migrate, boot API/admin, create the first owner, create/publish/deliver one entry, and verify the selected storage/plugin/frontend/locale options.

---

## 13. Deployment and operations gaps

### 13.1 Docker and topology

- Root Docker Compose calls itself full stack but includes PostgreSQL, Redis, and API only; there is no admin service.
- Local upload volume is mounted, but uploaded files are not served.
- The standalone API image does not automatically migrate; only Compose overrides the command to migrate.
- Production API image omits filesystem plugins.
- Redis has no authentication/TLS example and does not enable AOF.
- Default database password is fixed in Compose and examples.
- There is no backup/restore, migration rollback, secret rotation, or disaster-recovery runbook.
- There is no multi-instance guidance for BullMQ schedulers, in-memory MCP sessions, local uploads, or plugin loading.
- The repository has one 902-line initial migration named 20260427025504_add_password_reset_token that creates the entire 38-model schema. This obscures migration intent and provides no exercised incremental upgrade history.

### 13.2 Environment validation

- Root env example does not fully explain every OAuth, mail, integration, R2, Sentry, Stripe, and public/admin URL requirement.
- Storage credentials are optional even when the selected provider requires them.
- gcs is accepted but unimplemented.
- minio is offered elsewhere but rejected.
- CORS defaults to wildcard while credentials are enabled. Production templates must require explicit origins.
- SITE_URL and ADMIN_URL responsibilities are confused in email/OAuth flows.
- JWT signing and secret encryption reuse one key in several places.
- Dynamic settings and environment settings duplicate one another with different effects.

### 13.3 Framework and package warnings

The successful build still reports:

- experimental.typedRoutes moved to typedRoutes.
- Next middleware convention is deprecated in favor of proxy.
- SDK package exports puts types after import/require, so the condition is reported as unreachable.
- Prisma package.json configuration is deprecated in favor of prisma.config.ts.
- Astro docs sitemap skipped because site is not configured.
- pnpm reports that the pnpm configuration field is no longer read for overrides and onlyBuiltDependencies in this execution environment.

These are not all immediate failures, but they are upgrade debt and can turn into CI or production failures.

---

## 14. Dependency and supply-chain findings

pnpm audit --prod reported 18 known production dependency advisories:

- 0 critical.
- 0 high.
- 11 moderate.
- 7 low.

Affected packages include:

- next-intl 4.9.1 prototype-pollution advisory; patched at 4.9.2.
- icu-minify 4.9.1 denial-of-service advisory; patched at 4.9.2.
- uuid 11.1.0 bounds-check advisory through BullMQ; patched at 11.1.1.
- qs 6.15.1 remotely triggerable denial-of-service advisory; patched at 6.15.2.
- body-parser 2.2.2 denial-of-service advisory; patched at 2.3.0.
- Astro 6.4.8 XSS advisories; relevant patches are in newer Astro releases.
- DOMPurify 3.4.1 through isomorphic-dompurify, with multiple sanitizer/XSS advisories.

The DOMPurify chain deserves priority because Kast sanitizes untrusted rich-text content before storage and uses that behavior as a security control. Confirm which advisories apply to the exact server-side options, then upgrade or replace the chain and add malicious-payload regression tests.

The root overrides and allowed-build-dependency settings should be moved to the package manager's currently supported configuration location, then verified with a clean CI install. A lockfile containing a patched override is not sufficient if the package manager says it is ignoring the configuration.

---

## 15. Test and quality gap analysis

### 15.1 Results observed

| Check                       | Result           | Notes                                                               |
| --------------------------- | ---------------- | ------------------------------------------------------------------- |
| Prisma client generation    | Pass             | Required before API type/lint/test in this workspace                |
| Lint                        | Pass             | 6 packages have lint tasks; other packages have no lint script      |
| Type check                  | Pass             | 10 tasks passed after generating Prisma and Next route types        |
| API unit tests              | Pass             | 14 suites, 170 tests                                                |
| CLI E2E                     | Pass             | 7 scaffold/file tests                                               |
| Production build            | Pass             | 14 packages after frozen install and cache refresh                  |
| Format check                | Fail             | .claude/settings.local.json is not Prettier-compliant               |
| Production dependency audit | Fail             | 18 advisories: 11 moderate, 7 low                                   |
| API E2E                     | Not run          | No isolated kast_test database; suite would truncate its target     |
| Live API health             | Pass             | Database indicator up                                               |
| Live anonymous access probe | Security failure | Management content types/status filters and media returned HTTP 200 |

### 15.2 Coverage by subsystem

API unit specs exist for authentication, content service, roles, SEO, API tokens, users, webhooks, audit interceptor, CSV, MIME magic, redaction, secret crypto, rich-text sanitization, and SSRF utility.

Notable API areas without focused unit specs:

- Content-type service/repository and field configuration.
- Delivery service.
- Media service, storage adapters, processor, folder service, and cleanup.
- Forms.
- Menus.
- Locales.
- Settings and maintenance middleware.
- Plugin loader/service and each production plugin.
- MCP registry/service/transport/tools/session/audit behavior.
- Agent-token service/strategy.
- Trash scheduler/processor and cross-model pagination.
- Publish worker reconciliation.
- Email templates and transports.
- Queue adapter/board authentication.
- Dashboard.
- Health beyond database.
- Search.
- Stripe controller.

Cross-layer test gaps:

- No admin tests.
- No SDK tests.
- No plugin tests.
- No content-type-to-entry validation tests because the validator does not exist.
- No authorization matrix covering JWT, full/read-only/scoped API token, agent token, custom role, system role, anonymous, and inactive user.
- No contract tests generated from OpenAPI.
- No real MCP-client conformance test.
- No storage contract suite shared by local/S3/R2.
- No webhook SSRF or redirect-chain tests.
- No Docker image smoke tests.
- No deploy-template smoke tests.
- No accessibility, RTL visual regression, or keyboard navigation automation.
- No load/performance tests for the PRD thresholds.
- No migration-from-previous-release tests.
- No backup/restore tests.
- No coverage thresholds.

### 15.3 CI gaps

CI performs useful lint/type/test/build/audit actions, but should additionally:

1. Generate Prisma before every dependent task in the task graph.
2. Generate/check Next route types deterministically.
3. Run API E2E against an ephemeral kast_test database and Redis.
4. Run scaffold boot tests.
5. Build Docker images and probe health.
6. Run SDK/API contract tests.
7. Run admin Playwright tests, accessibility checks, and a minimal RTL visual baseline.
8. Exercise MCP with a real client.
9. Fail on approved vulnerability severity/SLA policy.
10. Verify docs links, code samples, sitemap, and route references.

---

## 16. Documentation and plan drift

The documentation is extensive but cannot currently be treated as executable truth.

### Confirmed examples of drift

- README says Next.js 15; installed workspace builds with Next 16.3.
- README identifies apps/web-docs as the Astro docs site; apps/docs is Astro, while apps/web-docs is a Next public starter.
- Public URLs vary between kastcms.com/docs and docs.kast.dev.
- README and MCP docs advertise /mcp; implemented routes are versioned under /api/v1/mcp.
- API specification often uses older content paths, while implementation uses /content-types/:typeSlug/entries.
- Forms documentation uses request fields, enum casing, authentication claims, pagination, status code, and response body that do not match the controller.
- Security model mentions bcrypt in places; implementation correctly uses Argon2id.
- Security checklist remains unchecked and describes itself as ready for implementation.
- Phase Definition-of-Done checkboxes remain unchecked even where code exists.
- Plans claim scoped RBAC, MCP audit/session behavior, settings effects, plugin completion, and security controls that the code does not enforce.
- Queue count varies between six and seven.
- Root README describes a release version that does not correspond to package versions.

### Documentation process needed

- Make OpenAPI the source for REST paths and schemas.
- Generate SDK types and API reference examples from that source.
- Add doc code-sample tests.
- Track requirements with stable IDs mapped to implementation and tests.
- Mark every feature as implemented, partial, deferred, or aspirational.
- Require documentation updates in the same PR as route/contract changes.
- Replace visual screenshots as completion evidence with runnable acceptance tests.

---

## 17. Complete module-by-module status

| Module                      | Present       | Current state                                                                                    | Readiness                              |
| --------------------------- | ------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------- |
| Authentication              | Yes           | Password, refresh, OAuth, reset, setup exist; recovery/OAuth/invite/logout and setup race remain | Not beta-ready                         |
| Users                       | Yes           | CRUD/invite/hierarchy checks; invite onboarding incomplete                                       | Partial                                |
| System roles                | Yes           | Hard-coded role checks function                                                                  | Usable with tests                      |
| Custom roles/permissions    | UI + DB + API | Not enforced on application routes                                                               | Nonfunctional                          |
| API tokens                  | Yes           | Hash/revoke/list/create work; scope ignored                                                      | Unsafe                                 |
| Agent tokens                | Yes           | Hash/revoke/scope list; REST escape and weak validation                                          | Unsafe                                 |
| Content types               | Yes           | CRUD/fields work; config/reorder mismatch                                                        | Partial                                |
| Content entries             | Yes           | Lifecycle/locales/versions exist; schema validation and type binding missing                     | Unsafe for governed content            |
| Public delivery             | Yes           | Published-only service exists                                                                    | Undermined by public management routes |
| Localization                | Yes           | Locale registry/fallback/admin/RTL exist                                                         | Moderate                               |
| Versioning                  | Yes           | Snapshot/list/revert exist; races/retention need work                                            | Partial                                |
| SEO                         | Yes           | Metadata/checks/gate/redirect/sitemap exist; analyzer/settings/routing issues                    | Partial                                |
| Media                       | Yes           | Upload/folders/processing exist; local serving, trash, variants, limits broken                   | Not deployable on local storage        |
| Forms                       | Yes           | Builder/submission/export exist; validation/notify/read/docs absent                              | Partial                                |
| Menus                       | Yes           | CRUD/tree and delivery exist                                                                     | Needs deeper tests                     |
| Webhooks                    | Yes           | Signing/encryption/retry/log exist; SSRF and event gaps                                          | Unsafe until SSRF fix                  |
| Audit                       | Yes           | Successful mutation baseline                                                                     | Not compliance-grade                   |
| Trash                       | Yes           | Multi-model UI/API and some purge                                                                | Incomplete recovery/retention          |
| Settings                    | Yes           | Storage and admin screens                                                                        | Mostly configuration facade            |
| Queues                      | Yes           | Six active processors plus unused audit queue                                                    | Partial operations                     |
| Health                      | Yes           | Database only                                                                                    | Insufficient                           |
| MCP                         | Yes           | 15-tool skeleton                                                                                 | Not security/protocol ready            |
| Plugin SDK                  | Yes           | Minimal hooks/config/manifest                                                                    | Too limited for promised adapters      |
| Plugin manager              | Yes           | Metadata CRUD + filesystem loader                                                                | Lifecycle broken                       |
| Meilisearch plugin/search   | Yes           | Per-type indexing logic                                                                          | Production wiring inconsistent         |
| R2 plugin                   | Yes           | Standalone adapter logic                                                                         | Cannot register with core              |
| Resend plugin               | Yes           | Standalone transport logic                                                                       | Cannot register with core              |
| Sentry plugin               | Yes           | Initialization/capture methods                                                                   | Request integration split              |
| Stripe plugin               | Yes           | Outbound sync logic                                                                              | Inbound/host integration disconnected  |
| Admin                       | Yes           | Broad polished interface                                                                         | Needs contract fixes and E2E           |
| SDK                         | Yes           | Broad resources/types                                                                            | Contract drift and no tests            |
| create-kast-app             | Yes           | Copies a project and passes shallow E2E                                                          | Template/options need end-to-end proof |
| Public blog starter         | Yes           | Builds                                                                                           | Needs delivery contract tests          |
| Public docs starter         | Yes           | Builds                                                                                           | Needs delivery contract tests          |
| Product docs site           | Yes           | 78 pages build                                                                                   | Accuracy and sitemap work needed       |
| Deployment templates        | Yes           | Docker/Railway/Render/Vercel files                                                               | Topology/config/plugin gaps            |
| AI content/image generation | Schema only   | Deliberately v2 in architecture                                                                  | Deferred, not implemented              |

---

## 18. What is completely missing

The following are not merely incomplete implementations; a necessary capability or proof layer is absent:

1. Runtime content-schema enforcement.
2. Runtime fine-grained permission enforcement.
3. API-token scope guard.
4. Agent-token REST isolation.
5. Safe production owner bootstrap.
6. Secure dynamic-secret storage/redaction.
7. Local media serving or download route.
8. Restorable media object lifecycle.
9. Real plugin installation/removal and enabled-state loading.
10. Production packaging for filesystem plugins.
11. Plugin extension registration for storage, email, routes, search, admin UI, and error reporting.
12. MCP conformance/integration tests and a genuine connection session model.
13. Invitation acceptance/password setup.
14. Admin automated tests.
15. SDK automated tests.
16. Plugin automated tests.
17. Authorization matrix tests.
18. OpenAPI-to-SDK generation.
19. Storage adapter contract tests.
20. Webhook egress security policy.
21. Redis/queue/storage/plugin health checks.
22. Backup/restore and disaster-recovery procedure.
23. Migration upgrade tests from a previous released schema.
24. Performance/load tests for stated PRD targets.
25. Accessibility automation.
26. Multi-instance operating model.
27. Observability dashboards/alerts for failed jobs, webhook backlog, publication delay, and storage failures.
28. AI drafting/image/migration features beyond reserved schema, as correctly deferred to v2 in parts of the architecture.

---

## 19. Prioritized remediation roadmap

### Phase A — Containment and truth reset, 1–2 weeks

**Goal:** stop data/credential exposure and stop overstating safety.

1. Protect all management content/content-type/media endpoints.
2. Restrict agent tokens to MCP.
3. Enforce API-token READ_ONLY immediately; temporarily disable SCOPED creation until full guard exists.
4. Remove fixed production seed credential and repair README.
5. Redact/encrypt/remove SMTP and plugin secrets from Global Settings responses.
6. Add webhook SSRF blocking and response-size limits.
7. Bind entry IDs to content type.
8. Patch production dependency advisories, prioritizing DOMPurify/next-intl/Astro.
9. Mark custom roles, plugin install, and dynamic settings as experimental or hide their controls until functional.
10. Add regression tests for every containment change.

**Exit gate:** anonymous and restricted-token negative tests pass; no known default credential or plaintext returned secret remains.

### Phase B — Core CMS integrity, 2–4 weeks

**Goal:** make the content model authoritative.

1. Implement schema compiler and validation for every field type.
2. Enforce unique/UID/relation/media/localization constraints.
3. Align field DTO/API/SDK/admin and implement reorder.
4. Implement bulk routes or remove buttons/methods.
5. Fix type-bound repository queries and version races.
6. Add cross-path validation tests for REST, MCP, version revert, import, and admin.
7. Introduce generated OpenAPI contract and SDK contract suite.

**Exit gate:** invalid content cannot be persisted through any entry path.

### Phase C — Auth and admin workflow completion, 2–3 weeks

**Goal:** make every user lifecycle work in a split deployment.

1. Fix public middleware route list.
2. Use ADMIN_PUBLIC_URL for recovery and OAuth.
3. Replace OAuth query tokens with one-time code exchange.
4. Implement invite tokens and accept-invite flow.
5. Make reset consumption atomic and setup concurrency-safe.
6. Fix logout revocation and session profile.
7. Fix token-rotation stale client hooks.
8. Add Playwright tests for setup, login, refresh, logout, reset, OAuth mock, invite, role restriction, content edit, media, forms, and RTL.

**Exit gate:** all auth/onboarding flows pass from a clean browser with API and admin on separate origins.

### Phase D — Media, settings, SEO, forms, and recovery, 3–5 weeks

1. Serve local media safely and add storage contract tests.
2. Keep objects through trash retention; model variants and cleanup.
3. Apply upload limits before buffering and define SVG policy.
4. Decide env-only versus dynamic settings and wire every retained control.
5. Correct SEO rich-text analysis and configurable publish gates.
6. Enforce form schemas and implement notifications/read state.
7. Complete trash purge for users/forms and stable cross-model pagination.
8. Make scheduled publish and storage cleanup reconciliable/idempotent.

### Phase E — RBAC, MCP, and plugin platform, 4–8 weeks

1. Implement one shared permission engine for REST, SDK, admin visibility, API tokens, and MCP.
2. Finalize MCP tool list, schemas, transport, auditing, sessions, and conformance tests.
3. Define trusted-plugin beta model.
4. Load only enabled plugins and package them in production.
5. Add storage/email/search/route/admin/error extension points.
6. Wire or reclassify every first-party plugin.
7. Add plugin contract tests and failure isolation.

### Phase F — Production operations and release, 2–4 weeks

1. Build full-stack Docker topology including admin.
2. Add ephemeral E2E DB/Redis in CI, Docker smoke tests, and scaffold boot tests.
3. Add Redis persistence/security, health indicators, metrics, alerts, and dead-letter procedures.
4. Add backup/restore and migration upgrade drills.
5. Run security review, accessibility review, and performance tests.
6. Reconcile package versions, changelog, release notes, docs, and support policy.
7. Freeze a beta acceptance matrix and require evidence for every claim.

---

## 20. Recommended release gates

### Security gate

- No anonymous access to management routes.
- API and agent token scope matrix passes.
- Custom permission engine passes deny-by-default tests.
- No fixed privileged credentials.
- No plaintext secret API responses or persisted setting values.
- Webhook and remote media SSRF tests pass.
- Upload size/MIME/SVG policy tests pass.
- Dependency audit has no unaccepted advisory above the project's threshold.

### Data-integrity gate

- Every content/form field type has positive and negative tests.
- Uniqueness and relation constraints are safe under concurrency.
- Version revert revalidates current schema or has an explicit migration policy.
- Trash restore returns a usable record and physical asset.
- Scheduled publishing survives worker restart and reconciliation.

### Contract gate

- OpenAPI generated from running API.
- SDK generated/aligned and contract tests pass.
- Admin browser tests use only documented SDK/API methods.
- Documentation code samples are tested.
- CLI-generated project installs, migrates, boots, and completes one CMS lifecycle.

### Operational gate

- Full-stack image deploy is reproducible.
- Database, Redis, storage, queues, and workers have health/metrics.
- Backup restore has been exercised.
- Migration from the previous release has been exercised.
- Multi-instance behavior is documented and tested.
- Runbooks exist for failed queues, storage outage, secret rotation, and rollback.

---

## 21. Suggested ownership split

| Workstream            | Primary scope                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------- |
| Security/auth         | Public route containment, token policy, setup/reset/OAuth/invite, secret handling, CORS/CSP |
| Content platform      | Schema compiler, constraints, type binding, versions, bulk, delivery                        |
| Admin/SDK             | Contract alignment, session-aware client, route flows, browser tests                        |
| Media/data lifecycle  | Storage serving, limits, variants, trash, purge, adapter tests                              |
| MCP/RBAC              | Shared permission engine, agent boundary, protocol, scopes, session/audit                   |
| Plugins/integrations  | Lifecycle, packaging, extension APIs, first-party wiring                                    |
| Platform/operations   | Docker, CI, health, Redis, observability, backup/migrations                                 |
| Documentation/release | OpenAPI generation, docs truth, package versions, acceptance evidence                       |

These streams can run in parallel only after the Phase A security contracts and the shared authorization/content-validation design are agreed. Otherwise, each layer will continue inventing incompatible policies.

---

## 22. Final assessment

Kast has enough implemented surface area to justify continued investment. The architecture and UI demonstrate a clear product, and the codebase has several solid foundations: strict validation infrastructure, good token hashing primitives, event/queue boundaries, a broad data model, a published-only delivery service, rich admin coverage, RTL support, useful sanitization/SSRF utilities, and working builds/tests.

The immediate need is not more screens or more modules. It is to make the existing claims true at every boundary:

- one authoritative content schema;
- one authoritative permission engine;
- one safe public delivery boundary;
- one generated API/SDK contract;
- one complete auth/session lifecycle;
- one recoverable media/trash lifecycle;
- one honest plugin execution model;
- one conformant MCP security/audit model;
- and one production acceptance suite.

If the P0 findings are addressed first and the roadmap is followed in dependency order, Kast can move from a broad engineering preview to a credible beta without discarding its current architecture. Shipping before those boundaries are enforced would create avoidable data exposure, privilege, credential, and content-integrity risk.

---

## Appendix A — Important evidence paths

- Product definition: README.md; docs/architecture/KAST_VISION.md; KAST_PRD.md.
- API contract: docs/architecture/KAST_API_SPEC.md; apps/api/src.
- Database: apps/api/prisma/schema.prisma and prisma/migrations.
- Security: docs/architecture/KAST_SECURITY_MODEL.md; apps/api/src/common; auth/tokens/roles/settings modules.
- Public/management content boundary: content.controller.ts; content.repository.ts; delivery.controller.ts; delivery.service.ts.
- Content modeling: content-types module; content service and DTOs; SDK content types; admin field builder.
- Admin session: apps/admin/src/lib/session.tsx; middleware.ts; app/api/auth routes.
- Media: apps/api/src/modules/media.
- MCP: apps/api/src/modules/mcp and agent-tokens.
- Plugins: packages/plugin-sdk; apps/api/src/modules/plugin; plugins.
- Forms: apps/api/src/modules/forms; SDK forms resource; forms docs.
- Deployment: docker-compose.yml; app Dockerfiles; deploy configs; .env.example.
- Tests/CI: apps/api/src/\*_/_.spec.ts; apps/api/test; packages/create-kast-app/test; .github/workflows.

## Appendix B — Audit command summary

The principal verification commands were:

- pnpm db:generate
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm --filter create-kast-app test:e2e
- pnpm build
- pnpm format:check
- pnpm audit --prod
- read-only Docker/PostgreSQL inventory
- read-only HTTP probes against http://127.0.0.1:3100

Generated build and type caches were refreshed during verification. Tracked Next-generated declaration changes were restored; this report is the intended repository change from the audit.

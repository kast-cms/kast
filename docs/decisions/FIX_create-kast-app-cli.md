# Fix Plan: `create-kast-app` CLI

**Status:** In Progress  
**Date:** 2026-05-03  
**Branch:** `fix/create-kast-app-cli`

---

## Problem Summary

When a user runs `npx create-kast-app my-site`, the generated project fails to start:

1. **`turbo` not installed** — `pnpm dev` / `pnpm build` exits with "turbo: command not found"
2. **Prisma client never generated** — `@prisma/client` can't be imported, `db:migrate` crashes
3. **Redis host wrong** — `.env` has `REDIS_HOST=redis` (Docker service name) instead of `localhost`
4. **No option to skip admin** — Admin is always included, no backend-only mode
5. **Missing devDependencies** — `eslint`, `globals`, `typescript-eslint`, `prettier`, `husky`, `lint-staged` not in root `package.json`
6. **`pmVersion` can be `null`** — renders `pnpm@` in generated `packageManager` field

---

## Identified Bugs

### Bug 1: `turbo` missing from root devDependencies

**File:** `src/templates/package-json.ts`  
**Root cause:** The generated root `package.json` has scripts like `"dev": "turbo dev"` but never includes `turbo` in `devDependencies`.  
**Fix:** Add `"turbo": "^2.0.0"` to the `devDependencies` section of `PACKAGE_JSON_TEMPLATE`.

### Bug 2: No `postinstall` for Prisma client generation

**File:** `template/apps/api/package.json`  
**Root cause:** After `pnpm install`, Prisma client is not generated. Users must manually run `db:generate` before anything works.  
**Fix:** Add `"postinstall": "prisma generate"` to `template/apps/api/package.json` scripts.

### Bug 3: Redis host uses Docker service name

**File:** `src/templates/env-example.ts`  
**Root cause:** Template has `REDIS_HOST=redis` which only works inside Docker. Local dev runs outside Docker.  
**Fix:** Change default to `REDIS_HOST=localhost`. Add a comment for Docker users.

### Bug 4: Missing ESLint/Prettier/Husky devDependencies

**File:** `src/templates/package-json.ts`  
**Root cause:** The template copies `eslint.config.ts`, `prettier.config.mjs`, `commitlint.config.ts`, `lint-staged.config.mjs` but the generated root `package.json` has none of their required packages.  
**Fix:** Add all required devDependencies:

- `eslint`, `globals`, `typescript-eslint`
- `prettier`, `prettier-plugin-organize-imports`
- `husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional`, `@commitlint/types`

### Bug 5: `pmVersion` renders as `null`

**File:** `src/scaffold.ts` → `buildContext()`  
**Root cause:** `detectPmVersion()` returns `string | null`. When null, `PACKAGE_JSON_TEMPLATE` renders `"packageManager": "pnpm@"`.  
**Fix:** The `resolvePmVersion()` function already has fallbacks, but `buildContext` should assert non-null before passing to Handlebars.

### Bug 6: No admin install choice

**File:** `src/types.ts`, `src/prompts.ts`  
**Root cause:** `FrontendStarter = 'none' | 'blog' | 'docs'` — the admin is always copied. No backend-only option.  
**Fix:** Add `includeAdmin: boolean` to `ProjectOptions`. Add a new prompt asking whether to include the admin panel.

### Bug 7: `workspace:*` only works with pnpm

**File:** `template/apps/api/package.json`, `template/apps/admin/package.json`  
**Root cause:** Both use `"@kast-cms/plugin-sdk": "workspace:*"` and `"@kast-cms/sdk": "workspace:*"`. This is pnpm-specific syntax — npm/yarn/bun use different workspace protocols.  
**Fix:** For npm/yarn/bun, replace `workspace:*` with `*` or use the workspace protocol that PM supports. Alternatively, keep `workspace:*` and document pnpm as required.

---

## Design Decisions (User-Confirmed)

| Decision                          | Choice                                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Backend-only project structure    | **Single API project** — no Turborepo, no monorepo, flat NestJS project                                           |
| Full-stack (with admin) structure | **Keep Turborepo monorepo** — just fix the missing deps                                                           |
| Database setup experience         | **Auto-detect + offer Docker** — check if Postgres is reachable, offer to start docker-compose for postgres+redis |
| Environment file strategy         | **Single `.env` for local dev** — localhost defaults, Docker overrides in docker-compose.yml                      |

---

## Implementation Plan

### Phase 1: Critical Fixes (Both Modes)

These fixes apply regardless of whether admin is included.

#### 1.1 Fix root `package.json` template

**File:** `src/templates/package-json.ts`

Add to `devDependencies`:

```json
{
  "devDependencies": {
    "turbo": "^2.0.0",
    "eslint": "^9.0.0",
    "globals": "^15.0.0",
    "typescript-eslint": "^8.0.0",
    "prettier": "^3.3.0",
    "prettier-plugin-organize-imports": "^4.1.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0",
    "@commitlint/cli": "^19.0.0",
    "@commitlint/config-conventional": "^19.0.0",
    "@commitlint/types": "^19.0.0",
    "typescript": "^5.5.0"
  }
}
```

#### 1.2 Fix API `package.json`

**File:** `template/apps/api/package.json`

Add postinstall script:

```json
"postinstall": "prisma generate"
```

#### 1.3 Fix `.env.example` template

**File:** `src/templates/env-example.ts`

Change:

```
REDIS_HOST=redis   →   REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=
# For Docker: change REDIS_HOST to "redis"
```

#### 1.4 Fix `pmVersion` null safety

**File:** `src/scaffold.ts`

In `buildContext()`, ensure `pmVersion` is always a string:

```ts
const safePmVersion = pmVersion || '9.0.0'; // fallback
```

---

### Phase 2: Backend-Only Mode

When user chooses **not** to include the admin panel.

#### 2.1 Update `ProjectOptions` type

**File:** `src/types.ts`

```ts
export interface ProjectOptions {
  projectName: string;
  packageManager: PackageManager;
  apiPort: number;
  includeAdmin: boolean; // NEW
  i18n: boolean;
  defaultLocale: string;
  extraLocales: string[];
  storageProvider: StorageProvider;
  plugins: string[];
  frontendStarter: FrontendStarter;
  deployTarget: DeployTarget;
}
```

#### 2.2 Add admin prompt

**File:** `src/prompts.ts`

Add a new prompt after project name:

```
◆ Include the admin panel (Next.js)?
  ● Yes — full-stack with admin dashboard
  ○ No — API backend only
```

When "No" is selected:

- Skip `i18n`, `frontendStarter`, `deployTarget` prompts
- Set `includeAdmin: false`, `frontendStarter: 'none'`, `deployTarget: 'none'`

#### 2.3 Create backend-only scaffold path

**File:** `src/scaffold.ts`

New flow for backend-only:

```
1. Create target directory
2. Copy only template/apps/api/* contents into target root
3. Copy template/packages/sdk/* into target as packages/sdk/ (or inline)
4. Copy template/packages/plugin-sdk/* into target as packages/plugin-sdk/
5. Generate flat package.json (no turbo, no workspaces)
6. Generate .env.example, .gitignore, README.md
7. Generate simplified docker-compose.yml (no admin service)
8. Run pm install
9. Run prisma generate
10. git init + commit
```

Backend-only root `package.json` structure:

```json
{
  "name": "my-project",
  "private": true,
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "node dist/main.js",
    "db:migrate": "prisma migrate dev",
    "db:migrate:prod": "prisma migrate deploy",
    "db:seed": "ts-node -r tsconfig-paths/register prisma/seed.ts",
    "db:generate": "prisma generate",
    "docker:up": "docker-compose up -d"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@nestjs/cli": "^11.0.6",
    "prisma": "^6.5.0"
  }
}
```

The API dependencies from `template/apps/api/package.json` are merged into the root.

#### 2.4 Create backend-only templates

New files in `src/templates/`:

- `package-json-api-only.ts` — Flat API-only package.json template
- `docker-compose-api-only.ts` — Simplified docker-compose (postgres + redis + api only)
- `readme-api-only.ts` — Backend-only README

#### 2.5 Backend-only project structure

```
my-project/
├── src/                    # NestJS source (flat, no workspace nesting)
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   ├── config/
│   ├── modules/
│   └── prisma/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── packages/               # SDK still available for building frontends later
│   ├── sdk/
│   └── plugin-sdk/
├── docker-compose.yml
├── .env.example
├── .env
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
├── .gitignore
└── README.md
```

---

### Phase 3: Full-Stack Mode (With Admin) — Fix Existing Issues

When user chooses **yes** to include admin.

#### 3.1 Keep Turborepo, fix all deps

The current monorepo flow stays, but with:

- `turbo` in root `devDependencies` (Phase 1 fix)
- All ESLint/Prettier/Husky deps in root `devDependencies` (Phase 1 fix)
- `postinstall: "prisma generate"` in API package.json (Phase 1 fix)

#### 3.2 Conditional admin copying

**File:** `src/scaffold.ts`

Only copy `template/apps/admin/` when `includeAdmin === true`.

Only copy `template/packages/sdk/` when `includeAdmin === true` (backend-only can include it optionally).

#### 3.3 Generate `pnpm-workspace.yaml` correctly

For pnpm with admin: generate workspace file with `apps/*`, `packages/*`, `plugins/*`.
For backend-only: no workspace file needed.

---

### Phase 4: Database Connectivity Check

#### 4.1 Add `checkDatabaseConnection()`

**File:** `src/checks.ts`

```ts
export async function isDatabaseReachable(databaseUrl: string): Promise<boolean> {
  // Parse the URL, try a TCP connection to host:port
  // Return true if reachable, false otherwise
}
```

#### 4.2 Add `isDockerAvailable()`

**File:** `src/checks.ts`

```ts
export async function isDockerAvailable(): Promise<boolean> {
  try {
    await execa('docker', ['--version']);
    return true;
  } catch {
    return false;
  }
}
```

#### 4.3 Offer to start Docker services

After scaffold + install, in `scaffold.ts`:

```
◇ Checking database connectivity...
✖ PostgreSQL is not reachable at localhost:5432.

  Docker is available. Start postgres + redis?
  ● Yes
  ○ No, I'll handle it myself

  Starting postgres and redis via Docker...
  ✓ Services running.
```

#### 4.4 Run prisma generate + validate

After install (and optionally after starting Docker):

```ts
await execa(pm, ['run', 'db:generate'], { cwd: targetDir, stdio: 'inherit' });
```

---

### Phase 5: UX Improvements

| #   | Improvement                        | Description                                                                             |
| --- | ---------------------------------- | --------------------------------------------------------------------------------------- |
| 5.1 | **Colored spinner during install** | Show `◐ Installing dependencies with pnpm...` while `pm install` runs                   |
| 5.2 | **Dynamic success message**        | Different output for backend-only vs full-stack                                         |
| 5.3 | **`--yes` / `-y` flag**            | Accept all defaults non-interactively                                                   |
| 5.4 | **Version check**                  | Compare installed `create-kast-app` version against npm latest, suggest update if stale |
| 5.5 | **Validate project name**          | Ensure name doesn't conflict with existing npm packages                                 |
| 5.6 | **Post-scaffold health check**     | Verify key files exist, prisma client generated, dependencies installed                 |

---

### Phase 6: Success Message Updates

#### Backend-only success message:

```
✓ Done! Project created in ./my-project

  Next steps:
  $ cd my-project
  $ cp .env.example .env   # Set JWT_SECRET at minimum
  $ pnpm run db:migrate
  $ pnpm run dev

  API:    http://localhost:3000/api/v1
  MCP:    http://localhost:3000/mcp
  Docs:   http://localhost:3000/api/docs

  Tip: Connect any frontend using @kast-cms/sdk
  Documentation: https://docs.kast.dev
```

#### Full-stack success message:

```
✓ Done! Project created in ./my-project

  Next steps:
  $ cd my-project
  $ cp .env.example .env   # Set JWT_SECRET at minimum
  $ pnpm run db:migrate
  $ pnpm run dev

  Admin:  http://localhost:3001/admin
  API:    http://localhost:3000/api/v1
  MCP:    http://localhost:3000/mcp
  Docs:   http://localhost:3000/api/docs

  Tip: docker-compose.yml is available for production deployments.
  Documentation: https://docs.kast.dev
```

---

## Files to Create / Modify

| File                                       | Action                                                                                       | Phase   |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- | ------- |
| `src/templates/package-json.ts`            | **Major rewrite** — add all missing devDeps, support backend-only mode                       | 1, 2    |
| `src/templates/env-example.ts`             | **Fix** — localhost defaults for local dev                                                   | 1       |
| `src/templates/package-json-api-only.ts`   | **New** — flat API-only package.json template                                                | 2       |
| `src/templates/docker-compose-api-only.ts` | **New** — simplified docker-compose (no admin)                                               | 2       |
| `src/templates/readme-api-only.ts`         | **New** — backend-only README                                                                | 2       |
| `src/types.ts`                             | **Update** — add `includeAdmin: boolean`                                                     | 2       |
| `src/prompts.ts`                           | **Update** — add admin yes/no prompt, conditionally skip other prompts                       | 2       |
| `src/scaffold.ts`                          | **Major rewrite** — branch logic for backend-only vs monorepo, run prisma generate, DB check | 2, 3, 4 |
| `src/checks.ts`                            | **Update** — add `isDatabaseReachable()`, `isDockerAvailable()`, null-safe pmVersion         | 1, 4    |
| `src/index.ts`                             | **Update** — dynamic success message per mode                                                | 6       |
| `src/templates/docker-compose.ts`          | **Update** — conditional admin service                                                       | 3       |
| `src/templates/readme.ts`                  | **Update** — dynamic instructions per mode                                                   | 6       |
| `template/apps/api/package.json`           | **Fix** — add `postinstall: "prisma generate"`                                               | 1       |
| `template/.templateignore`                 | **Update** — consider including migrations for a working baseline                            | 2       |
| `test/cli.e2e.mjs`                         | **Update** — add tests for backend-only mode, verify deps, verify prisma                     | All     |

---

## Implementation Order

```
1. Phase 1: Critical fixes (missing deps, env defaults, null safety)
   ├── 1.1 Fix package-json.ts template
   ├── 1.2 Fix API package.json postinstall
   ├── 1.3 Fix env-example.ts localhost defaults
   └── 1.4 Fix pmVersion null safety

2. Phase 2: Backend-only mode
   ├── 2.1 Update ProjectOptions type
   ├── 2.2 Add admin prompt
   ├── 2.3 Create backend-only templates
   ├── 2.4 Implement backend-only scaffold path
   └── 2.5 Test backend-only generation

3. Phase 3: Full-stack mode fixes
   ├── 3.1 Fix all missing deps in monorepo mode
   ├── 3.2 Conditional admin copying
   └── 3.3 Workspace file generation

4. Phase 4: Database connectivity
   ├── 4.1 Add checkDatabaseConnection()
   ├── 4.2 Add isDockerAvailable()
   ├── 4.3 Offer Docker start
   └── 4.4 Run prisma generate after install

5. Phase 5: UX improvements
   ├── 5.1 Spinner during install
   ├── 5.2 Dynamic success message
   └── 5.3 --yes flag

6. Phase 6: Tests + docs
   ├── 6.1 Update e2e tests
   ├── 6.2 Manual end-to-end test
   └── 6.3 Bump version to 3.0.0 (breaking change)
```

---

## Risks & Mitigations

| Risk                                            | Mitigation                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| Template size bloats npm package                | `.npmignore` excludes `node_modules`, `dist`, `.next` from template                   |
| Backend-only path diverges from monorepo source | Shared source: both paths copy from same `template/apps/api/` files                   |
| `pnpm install` during scaffold takes too long   | Show spinner; `--skip-install` flag available                                         |
| Prisma generate fails if no DB                  | Run `prisma generate` (doesn't need DB), not `prisma migrate`                         |
| Docker not available for DB check               | Gracefully skip, show manual instructions                                             |
| `workspace:*` breaks for npm/yarn/bun           | In backend-only mode: no workspace, deps are direct. In monorepo mode: recommend pnpm |

---

## Out of Scope

- Changes to `@kast-cms/sdk` or `@kast-cms/plugin-sdk` packages
- Changes to `apps/api` or `apps/admin` source code
- Docker image publishing pipeline
- Plugin marketplace integration
- Web-blog / web-docs starter templates (can be added later)

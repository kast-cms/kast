# Plan: Rewrite `create-kast-app` to Copy Real Source Files

**Status:** Proposed  
**Date:** 2026-04-28

---

## Problem

`create-kast-app` currently generates only infrastructure files (`docker-compose.yml`, `.env`, `README.md`). The user gets empty `apps/`, `packages/`, and `plugins/` directories, then must pull a pre-built Docker image that may be broken or stale.

This model is unfamiliar to most developers and fails when the Docker images have not been correctly published (our current bug). It also gives users no way to customise or extend the CMS without cloning the entire monorepo manually.

---

## Goal

Make `create-kast-app` work like `create-next-app` / `create-t3-app`:

- Copies real, runnable source files into the new project
- Asks which package manager to use
- User runs `pnpm install && pnpm dev` and has a working CMS immediately — no Docker required to get started
- Docker Compose stays available as an optional production-deployment helper, not a hard runtime dependency

---

## What Changes

### 1. Source template directory inside the CLI package

Add `packages/create-kast-app/template/` that mirrors the monorepo structure the user will receive:

```
template/
  apps/
    api/                   ← full NestJS source (copied from apps/api/)
    admin/                 ← full Next.js source (copied from apps/admin/)
  packages/
    sdk/                   ← copied from packages/sdk/
    plugin-sdk/            ← copied from packages/plugin-sdk/
  plugins/                 ← empty placeholder with .gitkeep
  turbo.json
  tsconfig.base.json
  commitlint.config.ts
  eslint.config.ts
  prettier.config.mjs
  lint-staged.config.mjs
```

Files that stay as Handlebars templates (generated, not copied):
- `package.json` — needs `projectName`, `packageManager`
- `pnpm-workspace.yaml` / workspace file for the chosen PM
- `.env.example` / `.env`
- `docker-compose.yml` — optional, generated for reference
- `README.md`
- `.gitignore`

### 2. New `PackageManager` type and prompt

Add `packageManager` field to `ProjectOptions`:

```ts
export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun';
```

New prompt inserted **before** the port question:

```
◆ Which package manager do you use?
  ● pnpm  (recommended)
  ○ npm
  ○ yarn
  ○ bun
```

Auto-detect from `npm_config_user_agent` (the env var set when run via `npx`/`bunx`/etc.) and pre-select that option.

### 3. `scaffold.ts` — replace template-string generation with file copy

New flow:

```
1. Create target directory skeleton
2. Copy template/ tree into targetDir via recursive fs.cp()
3. Rename template files that contain {{}} placeholders and run Handlebars on them
4. Write generated files (package.json, .env.example, etc.)
5. Run `<packageManager> install` inside targetDir
6. Run prisma generate
7. git init + initial commit
```

Helper functions needed:
- `copyTemplate(src, dest)` — `fs.cp(src, dest, { recursive: true })`
- `renderAndWrite(templateStr, ctx, destPath)` — existing Handlebars render
- `runInstall(pm, cwd)` — execa wrapper that calls the right install command per PM:
  - pnpm → `pnpm install`
  - npm  → `npm install`
  - yarn → `yarn install`  
  - bun  → `bun install`

### 4. `package.json` template — become PM-aware

The generated root `package.json` will use the chosen PM's dev script:

```json
{
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "db:migrate": "pnpm --filter @kast-cms/api prisma:migrate",
    "db:seed":    "pnpm --filter @kast-cms/api prisma:seed",
    "docker:up":  "docker-compose up -d"
  },
  "packageManager": "{{packageManager}}@{{packageManagerVersion}}"
}
```

`pnpm-workspace.yaml` is only written when PM = pnpm. For npm/yarn/bun, use their workspace configs instead (`workspaces` field in package.json).

### 5. `docker-compose.yml` — demoted to optional reference

Still generated (so power-users can `docker-compose up` in production) but:
- API and admin images point to the GitHub repo's registry rather than a hardcoded Docker Hub tag
- README shows the **source** workflow as the primary path, Docker as secondary

### 6. Success message updates

Replace:
```
$ nano .env
$ docker-compose up
```

With:
```
$ cd my-app
$ cp .env.example .env      # edit JWT_SECRET
$ <pm> run db:migrate
$ <pm> run dev
```

Show package manager specific commands based on what the user chose.

### 7. `--skip-interactive` flag

Keep the flag. Default package manager for non-interactive mode: `pnpm`.

### 8. `tsup.config.ts` — bundle the template directory

The `template/` folder must ship inside the published npm package. Update `tsup.config.ts` and `package.json#files` to include it:

```ts
// tsup.config.ts — add copyFiles
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  sourcemap: false,
  banner: { js: '#!/usr/bin/env node' },
});
```

Add to `package.json`:
```json
"files": ["dist", "template", "README.md"]
```

### 9. E2E tests — update assertions

Tests that currently assert `docker-compose.yml` exists and references `odaybakkour/kast-api` need updating:

- Assert `apps/api/src/main.ts` exists (real source was copied)
- Assert `apps/admin/src/` exists
- Assert `package.json` contains `"dev": "turbo dev"`
- Remove assertion that `odaybakkour/kast-api` image is referenced as the primary entrypoint

---

## Files to Create / Modify

| File | Action |
|---|---|
| `packages/create-kast-app/src/types.ts` | Add `PackageManager` type and field |
| `packages/create-kast-app/src/prompts.ts` | Add PM prompt + auto-detect |
| `packages/create-kast-app/src/scaffold.ts` | Full rewrite — file copy + install |
| `packages/create-kast-app/src/checks.ts` | Add `detectPackageManager()` |
| `packages/create-kast-app/src/templates/package-json.ts` | PM-aware template |
| `packages/create-kast-app/src/templates/docker-compose.ts` | Change image refs |
| `packages/create-kast-app/src/index.ts` | Update `printSuccess()` |
| `packages/create-kast-app/package.json` | Add `template` to `files` |
| `packages/create-kast-app/tsup.config.ts` | No change needed (template is static) |
| `packages/create-kast-app/template/` | **New** — full source tree |
| `packages/create-kast-app/test/cli.e2e.mjs` | Update assertions |

---

## What Does NOT Change

- The `@kast-cms/sdk` and `@kast-cms/plugin-sdk` packages — unchanged
- The `apps/api` and `apps/admin` source code — only copied, not modified
- The Docker images on Docker Hub — still built and pushed via `publish.yml`, used for production Docker deployments
- The monorepo structure of the main repo

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Template size bloats npm package | `.npmignore` excludes `node_modules`, `dist`, `.next`, `prisma/migrations` from template copy |
| PM auto-detect is wrong | Always ask the user — auto-detect is just the pre-selected default, not forced |
| `pnpm install` during scaffold takes too long | Show a spinner; document offline/no-install flag |
| Template diverges from monorepo source | CI job: after build, `diff template/apps/api apps/api --exclude=node_modules` |

---

## Implementation Order

1. **Branch:** `fix/create-kast-app-file-copy`
2. Add `PackageManager` type + prompt (`types.ts`, `prompts.ts`, `checks.ts`)
3. Populate `template/` directory (copy from monorepo, add `.npmignore` for it)
4. Rewrite `scaffold.ts`
5. Update templates (`package-json.ts`, `docker-compose.ts`, `readme.ts`)
6. Update `index.ts` success message
7. Update `package.json#files`
8. Update e2e tests
9. Bump `create-kast-app` version to `2.0.0` (breaking change in generated output)

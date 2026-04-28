# Contributing to Kast CMS

Thank you for your interest in contributing to Kast! This guide covers everything you need to know.

---

## Development Setup

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker (for PostgreSQL + Redis)

### First-time setup

```bash
git clone https://github.com/kast-cms/kast.git
cd kast
pnpm install
cp apps/api/.env.example apps/api/.env
docker-compose up -d postgres redis
pnpm dev
```

---

## Branch Strategy

| Branch                          | Purpose                                        |
| ------------------------------- | ---------------------------------------------- |
| `main`                          | Production-ready. Protected. No direct pushes. |
| `develop`                       | Integration branch. Always shippable.          |
| `feature/<scope>/<description>` | New features                                   |
| `fix/<scope>/<description>`     | Bug fixes                                      |
| `docs/<description>`            | Documentation only                             |

**Always branch from `develop`. PRs go back to `develop`.**

---

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <description>
```

### Types

`feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`

### Scopes

`content` `seo` `auth` `media` `mcp` `i18n` `audit` `webhook` `queue` `plugin`
`form` `menu` `settings` `trash` `admin` `api` `sdk` `cli` `deps` `config`

### Examples

```bash
feat(content): add version history with diff view
fix(auth): resolve jwt refresh token not rotating
docs(mcp): document all tool definitions
chore(deps): upgrade @nestjs/bullmq to 10.2.1
```

---

## Code Standards

All code must follow [KAST_DEV_STANDARDS.md](./docs/KAST_DEV_STANDARDS.md):

- TypeScript strict mode — no `any`, no `@ts-ignore`
- ESLint zero warnings — all warnings are errors
- File limits: 300 lines max, 50 lines per function
- Tests required for all service methods (80% coverage minimum)

Run checks locally:

```bash
pnpm lint          # ESLint
pnpm typecheck     # TypeScript
pnpm test          # Jest / Vitest
pnpm format:check  # Prettier
```

---

## Pull Request Process

1. **Branch from `develop`** — never from `main`
2. **Write tests** for any new functionality
3. **Update docs** if you change public API or behavior
4. **PR title** must follow commit convention
5. **Link issues** — use `Closes #42` in the PR description
6. **Self-review** before requesting review
7. **Squash merge** into `develop`

### PR Template

When you open a PR, fill in the template:

- What does this change?
- Why is this change needed?
- How was it tested?
- Screenshots (for UI changes)

---

## How to Write a Plugin

Kast plugins extend the CMS without touching core code. They live in the `plugins/` directory and use `@kast-cms/plugin-sdk`.

### 1. Scaffold your plugin

```bash
mkdir plugins/kast-plugin-<name>
cd plugins/kast-plugin-<name>
pnpm init
```

Add `@kast-cms/plugin-sdk` as a dependency:

```bash
pnpm add @kast-cms/plugin-sdk
```

### 2. Create the manifest

Every plugin must have a `kast-plugin.json` at its root:

```json
{
  "name": "kast-plugin-<name>",
  "version": "0.1.0",
  "displayName": "My Plugin",
  "description": "What this plugin does",
  "permissions": ["content:read"],
  "hooks": ["content.published"],
  "adminPages": [
    {
      "label": "My Plugin",
      "path": "/plugins/<name>",
      "icon": "Puzzle"
    }
  ],
  "env": ["MY_PLUGIN_API_KEY"]
}
```

**Permissions** (`content:read`, `content:write`, `settings:read`, `settings:write`, `media:read`, `media:write`) — declare only what you need.

**Hooks** — the events your plugin subscribes to. Available hooks:

| Hook                  | Fired when                               |
| --------------------- | ---------------------------------------- |
| `content.created`     | A new content entry is saved             |
| `content.updated`     | An existing entry is updated             |
| `content.published`   | An entry transitions to `published`      |
| `content.unpublished` | A published entry is reverted to draft   |
| `content.trashed`     | An entry is moved to trash               |
| `content.deleted`     | An entry is permanently deleted          |
| `media.uploaded`      | A file is uploaded to the media library  |
| `media.deleted`       | A file is deleted from the media library |

### 3. Implement `IKastPlugin`

```typescript
import { IKastPlugin, KastPluginContext, PluginHook } from '@kast-cms/plugin-sdk';

export class MyPlugin implements IKastPlugin {
  async onLoad(ctx: KastPluginContext): Promise<void> {
    const config = await ctx.getConfig();
    const apiKey = process.env['MY_PLUGIN_API_KEY'] ?? '';

    ctx.on(PluginHook.CONTENT_PUBLISHED, async (payload) => {
      // payload is typed as `unknown` — narrow it before use
      const { entryId } = payload as { entryId: string };
      // ... call your external service
    });
  }
}
```

Export the class as the default export from your `src/index.ts`.

### 4. Persist plugin configuration

Use `ctx.getConfig()` / `ctx.setConfig()` for encrypted, persisted config (stored in `PluginConfig` — AES-256-GCM encrypted at rest):

```typescript
const config = await ctx.getConfig();
await ctx.setConfig({ webhookSecret: 'abc123' });
```

Never commit secrets. Store them via environment variables or through the admin plugin config UI.

### 5. Add an admin UI panel (optional)

If your `kast-plugin.json` declares an `adminPages` entry, create the corresponding Next.js page in `apps/admin/src/app/(dashboard)/plugins/<name>/page.tsx`. Use the existing plugin pages (e.g. `plugins/kast-plugin-meilisearch`) as a reference.

### 6. Test your plugin

Add an integration test in `plugins/kast-plugin-<name>/src/__tests__/` that:

1. Instantiates the plugin with a mock `KastPluginContext`
2. Fires each subscribed hook
3. Asserts the expected side effects

### 7. Reference implementations

Study the first-party plugins before writing your own:

| Plugin                                                          | What to learn                         |
| --------------------------------------------------------------- | ------------------------------------- |
| [`kast-plugin-meilisearch`](./plugins/kast-plugin-meilisearch/) | Hook subscriptions, BullMQ re-index   |
| [`kast-plugin-resend`](./plugins/kast-plugin-resend/)           | Email delivery, config validation     |
| [`kast-plugin-r2`](./plugins/kast-plugin-r2/)                   | Media hook, external storage          |
| [`kast-plugin-stripe`](./plugins/kast-plugin-stripe/)           | Webhook verification, idempotency     |
| [`kast-plugin-sentry`](./plugins/kast-plugin-sentry/)           | Error reporting, minimal surface area |

---

## Releasing

> Only maintainers with NPM publish rights and Docker Hub push access perform releases.

### Versioning policy

Kast follows [Semantic Versioning](https://semver.org/):

| Change                           | Bump    |
| -------------------------------- | ------- |
| Backwards-compatible new feature | `minor` |
| Bug fix, dependency update, docs | `patch` |
| Breaking API or schema change    | `major` |

All packages in the monorepo are released together at the same version (lock-step).

### Release process

1. **Merge `develop` → `main`** (squash merge, PR reviewed and CI green)
2. **Update changelogs** — generated automatically from conventional commits; review and adjust manually if needed
3. **Bump versions** in all `package.json` files to the new version
4. **Commit the version bump:**
   ```bash
   git commit -m "chore(release): v1.2.0"
   ```
5. **Tag the commit:**
   ```bash
   git tag v1.2.0
   git push origin main --tags
   ```
6. **The `publish.yml` workflow fires automatically** and:
   - Runs the CLI e2e smoke test
   - Publishes `create-kast-app` and `@kast-cms/sdk` to NPM
   - Builds and pushes `kasthq/api` and `kasthq/admin` Docker images (`:latest` and `:<version>`)
   - Creates a GitHub Release with auto-generated release notes

### Pre-release testing

Before tagging, test the release workflow against a release candidate:

```bash
git tag v1.2.0-rc.1
git push origin v1.2.0-rc.1
```

Verify the `publish.yml` run completes without errors. Delete the RC tag from NPM/Docker Hub before publishing the final release.

### Hotfixes

For critical production fixes:

1. Branch from `main`: `fix/critical/<description>`
2. Apply the fix, add a regression test
3. PR directly to `main`, single reviewer approval required
4. Cherry-pick to `develop` after merge

---

## Reporting Bugs

Use the [bug report template](https://github.com/kast-cms/kast/issues/new?template=bug_report.md).

Include:

- Kast version
- Node.js version
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs

---

## Code of Conduct

By participating in this project, you agree to our [Code of Conduct](./CODE_OF_CONDUCT.md).

---

## Questions?

- **GitHub Discussions** — for questions and ideas
- **Discord** — for real-time chat
- **Issues** — for bugs and feature requests only

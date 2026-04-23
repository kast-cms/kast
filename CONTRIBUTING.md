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

| Branch | Purpose |
|---|---|
| `main` | Production-ready. Protected. No direct pushes. |
| `develop` | Integration branch. Always shippable. |
| `feature/<scope>/<description>` | New features |
| `fix/<scope>/<description>` | Bug fixes |
| `docs/<description>` | Documentation only |

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

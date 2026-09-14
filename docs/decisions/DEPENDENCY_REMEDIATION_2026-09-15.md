# Dependency remediation — 15 September 2026

Reviewed all 33 open [Dependabot alerts](https://github.com/kast-cms/kast/security/dependabot)
(alerts 12–44) and all seven [open dependency PRs](https://github.com/kast-cms/kast/pulls).
The alerts comprised 7 critical, 14 high, 10 medium, and 2 low findings.

## Consolidated patches

| Package                          | Minimum patched version enforced |
| -------------------------------- | -------------------------------- |
| Next.js                          | 16.3.3                           |
| Astro                            | 7.2.8                            |
| sharp                            | 0.35.4                           |
| multer                           | 2.3.0                            |
| nodemailer                       | 9.1.1                            |
| js-yaml                          | 3.15.2 / 4.3.2                   |
| smol-toml                        | 1.7.1                            |
| hono                             | 4.13.5                           |
| qs                               | 6.16.0                           |
| svgo                             | 4.1.0                            |
| @tiptap/core and editor packages | 3.30.5                           |
| fast-uri                         | 3.1.6                            |
| postcss-selector-parser 6.x      | 6.1.3                            |

The API declares Hono directly because its MCP adapter consumes Hono as an
optional peer dependency; a transitive override alone left the old peer in the
lockfile. Overrides are synchronized in root package.json, pnpm-workspace.yaml,
and generated project templates. Both frontend starters receive the patched
Next.js constraint, and API-only scaffolds include the new auth dependencies.

## PR findings

- [#90](https://github.com/kast-cms/kast/pull/90),
  [#89](https://github.com/kast-cms/kast/pull/89),
  [#88](https://github.com/kast-cms/kast/pull/88),
  [#87](https://github.com/kast-cms/kast/pull/87), and
  [#86](https://github.com/kast-cms/kast/pull/86) overlap the Next.js, sharp,
  Nodemailer, Astro, and Multer patches above. Their individual updates cannot
  clear the audit while the remaining vulnerable packages are still installed.
- [#85](https://github.com/kast-cms/kast/pull/85) fails the audit gate. It also
  proposes Nest 12 test/tooling packages independently of the application's
  existing Nest version. Security patches do not require that migration.
- [#84](https://github.com/kast-cms/kast/pull/84) fails installation in both CI
  and scaffold smoke tests because Prisma 7 rejects the current schema's
  datasource URL configuration. Keep Prisma 6 for this patch; Prisma, Nest,
  TypeScript, and other major upgrades need separate compatibility work.

Dependabot now groups security updates together and excludes routine major-version
bumps from version-update PRs. This keeps major migrations out of the routine
security patch queue. The replacement consolidates the security fixes while
preserving compatible framework versions.

## Validation

- `pnpm audit --prod --audit-level=moderate`: no known vulnerabilities.
- Full dependency audit, including development dependencies: zero findings.
- Workspace lint, typecheck, unit tests, and production builds passed.
- API end-to-end tests passed against isolated PostgreSQL and Redis, including
  fresh migrations and preservation of existing MFA enrollments.
- CLI scaffold tests and source/template parity checks passed.
- Browser checks passed for login, MFA enrollment, recovery-code login,
  revocation, disabling MFA, mobile navigation, and browser metadata persistence.

GitHub alerts are evaluated against the default branch. Local remediation and
passing PR checks do not close them until the changes are merged into `main` and
GitHub refreshes the dependency graph.

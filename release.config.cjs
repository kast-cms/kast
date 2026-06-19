/**
 * Shared semantic-release config, consumed by `multi-semantic-release`.
 *
 * `multi-semantic-release` runs one semantic-release pass PER workspace package
 * that is NOT marked `private: true`, with `process.cwd()` set to that package's
 * directory. In this monorepo the non-private packages are exactly the three
 * publishable ones:
 *   - create-kast-app             (packages/create-kast-app)
 *   - @kast-cms/sdk               (packages/sdk)
 *   - @kast-cms/plugin-sdk        (packages/plugin-sdk)
 * Everything else (api, admin, the docs/blog apps, every plugins/*) is
 * `private: true` and is skipped automatically — so npm versioning is fully
 * independent and per-package, with no version churn for untouched packages.
 *
 * This single root config is reused for every package (no per-package config
 * files are written under packages/**). Because it executes once per package
 * with that package's cwd, we read the local package.json here to derive a
 * UNIQUE, package-scoped `tagFormat`. Distinct tag namespaces are what let each
 * package compute its own next version from its own history:
 *   create-kast-app        ->  create-kast-app-v${version}
 *   @kast-cms/sdk          ->  sdk-v${version}
 *   @kast-cms/plugin-sdk   ->  plugin-sdk-v${version}
 * These are deliberately distinct from the product tags `v${version}` used for
 * Docker/GitHub releases, so the two tag schemes never collide.
 *
 * IMPORTANT — versions only ever increase (never downgrade):
 * semantic-release derives the *next* version from the latest git tag matching
 * that package's `tagFormat`, NOT from package.json. Baseline tags at the current
 * published versions are seeded once by `scripts/bootstrap-release-tags.mjs`
 * (see README "Releasing"). That keeps @kast-cms/sdk on 0.3.x and
 * create-kast-app on 2.x on the very first automated run.
 */
const path = require('node:path');

// cwd is the package directory during each multi-semantic-release pass.
const pkg = require(path.join(process.cwd(), 'package.json'));

// Short, filesystem/tag-safe slug for the tag namespace.
const slug = pkg.name.replace(/^@kast-cms\//, '').replace(/[^a-zA-Z0-9-]/g, '-');

module.exports = {
  branches: ['main'],
  tagFormat: `${slug}-v\${version}`,
  plugins: [
    // 1. Decide the bump from Conventional Commits that touched this package's dir.
    ['@semantic-release/commit-analyzer', { preset: 'conventionalcommits' }],
    // 2. Generate release notes for the GitHub Release body.
    ['@semantic-release/release-notes-generator', { preset: 'conventionalcommits' }],
    // 3. Bump package.json in-tree and `npm publish` (provenance via env, see release.yml).
    //    Nothing is committed back to git -> no release commit, no release PR.
    ['@semantic-release/npm', { npmPublish: true }],
    // 4. Create the per-package git tag + GitHub Release. We intentionally do NOT
    //    add `@semantic-release/git`, so the version bump is never committed back
    //    to main (zero version churn on the branch).
    [
      '@semantic-release/github',
      {
        successComment: false,
        failComment: false,
        failTitle: false,
        labels: false,
        releasedLabels: false,
      },
    ],
  ],
};

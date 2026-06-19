/**
 * Shared semantic-release config, consumed by `multi-semantic-release` (msr).
 *
 * msr runs one semantic-release pass per workspace package. In release.yml we pass
 * `--ignore-private-packages`, so only the three NON-private packages are processed
 * (everything else — api, admin, the docs/blog apps, every plugins/* — is
 * `private: true` and skipped, producing no npm publish, no tag, no GitHub Release):
 *   - create-kast-app             (packages/create-kast-app)
 *   - @kast-cms/sdk               (packages/sdk)
 *   - @kast-cms/plugin-sdk        (packages/plugin-sdk)
 * npm versioning is therefore fully independent and per-package, with no version
 * churn for untouched packages.
 *
 * TAG FORMAT — controlled by msr, NOT here. msr forces a per-package tag namespace
 * of `${name}@${version}` and OVERRIDES any `tagFormat` set in this config (setting
 * one here has no effect), so we deliberately do not set `tagFormat`:
 *   create-kast-app        ->  create-kast-app@${version}
 *   @kast-cms/sdk          ->  @kast-cms/sdk@${version}
 *   @kast-cms/plugin-sdk   ->  @kast-cms/plugin-sdk@${version}
 * These are distinct from the product tags `v${version}` used for Docker/GitHub
 * releases, so the two tag schemes never collide.
 *
 * IMPORTANT — versions only ever increase (never downgrade):
 * semantic-release derives the *next* version from the latest git tag matching that
 * package's `${name}@*` namespace, NOT from package.json. Baseline tags at the
 * current published versions are seeded once by `scripts/bootstrap-release-tags.mjs`
 * (see README "Releasing"). Without them the first automated run treats each package
 * as a brand-new 1.0.0 release — keeping @kast-cms/sdk on 0.3.x and create-kast-app
 * on 2.x depends on those baselines existing.
 */
module.exports = {
  branches: ['main'],
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

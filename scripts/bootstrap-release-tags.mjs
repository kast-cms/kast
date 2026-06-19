#!/usr/bin/env node
/**
 * One-time bootstrap for the automated per-package release flow.
 *
 * WHY THIS EXISTS
 * ---------------
 * semantic-release computes the *next* version for a package from the latest git
 * tag matching that package's `tagFormat` — NOT from its package.json `version`.
 * This repo has product tags (v1.0.0 .. v1.0.4) but NO per-package tags yet, and
 * the publishable packages are already past their would-be first release:
 *   - create-kast-app    @ 2.1.0   (tag: create-kast-app-v<version>)
 *   - @kast-cms/sdk      @ 0.3.2   (tag: sdk-v<version>)
 *   - @kast-cms/plugin-sdk @ 0.1.0 (tag: plugin-sdk-v<version>)
 *
 * Without a baseline tag, the FIRST automated run would treat each as a brand-new
 * 1.0.0 release — downgrading create-kast-app (2.1.0 -> 1.0.0, which npm rejects)
 * and major-jumping the sdk off 0.3.x. This script creates a baseline ANNOTATED
 * tag at each package's CURRENT published version so the first automated bump is
 * computed from the correct floor and versions only ever increase.
 *
 * It is IDEMPOTENT: a baseline tag is created only if no tag already exists in
 * that package's namespace. Run it once, locally, by a maintainer who can push
 * tags, BEFORE merging the first release-triggering commit to main:
 *
 *     node scripts/bootstrap-release-tags.mjs            # create tags locally
 *     git push origin --tags                             # publish baselines
 *
 * Pass --dry-run to only print what it would do. The tags must point at a commit
 * that is an ancestor of main (HEAD on an up-to-date main is correct).
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

// The publishable packages and the tag namespace each one uses. The slug here
// MUST match the `slug` derivation in release.config.cjs.
const PACKAGES = [
  { dir: 'packages/create-kast-app', slug: 'create-kast-app' },
  { dir: 'packages/sdk', slug: 'sdk' },
  { dir: 'packages/plugin-sdk', slug: 'plugin-sdk' },
];

function sh(cmd) {
  return execSync(cmd, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

let created = 0;
for (const { dir, slug } of PACKAGES) {
  const pkg = JSON.parse(readFileSync(path.join(repoRoot, dir, 'package.json'), 'utf8'));
  const version = pkg.version;
  const tag = `${slug}-v${version}`;

  // Any existing tag in this namespace means the flow has already started.
  const existing = sh(`git tag -l "${slug}-v*"`);
  if (existing) {
    console.log(`✓ ${pkg.name}: namespace already has tags (${existing.split('\n').join(', ')}), skipping.`);
    continue;
  }

  if (dryRun) {
    console.log(`would create baseline tag ${tag} for ${pkg.name} @ ${version}`);
    continue;
  }

  sh(`git tag -a "${tag}" -m "chore(release): baseline ${pkg.name}@${version}"`);
  console.log(`+ created baseline tag ${tag} for ${pkg.name} @ ${version}`);
  created += 1;
}

if (!dryRun && created > 0) {
  console.log(`\nCreated ${created} baseline tag(s). Now run:  git push origin --tags`);
} else if (!dryRun) {
  console.log('\nNothing to do — all package namespaces already have tags.');
}

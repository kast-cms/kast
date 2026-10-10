#!/usr/bin/env node
/**
 * Production dependency audit that honors `pnpm.auditConfig.ignoreGhsas`.
 *
 * The pinned pnpm (9.0.0) predates `ignoreGhsas`, so `pnpm audit` alone cannot
 * skip an advisory that has no CVE and no patched release. This runs the same
 * audit and filters the report against the list in package.json, keeping that
 * list the single source of truth (newer pnpm honors it natively too).
 *
 *   node scripts/audit-prod.mjs
 *
 * Exits non-zero if any advisory at or above "moderate" is not ignored.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
const ignored = new Set(pkg.pnpm?.auditConfig?.ignoreGhsas ?? []);
const RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

const res = spawnSync('pnpm', ['audit', '--prod', '--json'], {
  cwd: REPO,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});

let report;
try {
  report = JSON.parse(res.stdout);
} catch {
  console.error(res.stdout || res.stderr || 'pnpm audit produced no JSON output');
  process.exit(1);
}

const advisories = Object.values(report.advisories ?? {});
const skipped = advisories.filter((a) => ignored.has(a.github_advisory_id));
const blocking = advisories.filter(
  (a) => !ignored.has(a.github_advisory_id) && RANK[a.severity] >= RANK.moderate,
);

for (const a of skipped) {
  console.log(
    `ignored  ${a.severity.padEnd(8)} ${a.module_name} ${a.github_advisory_id} (${a.title})`,
  );
}
for (const a of blocking) {
  console.error(
    `BLOCKING ${a.severity.padEnd(8)} ${a.module_name} ${a.github_advisory_id} ${a.url} (${a.title})`,
  );
}
console.log(`${blocking.length} blocking, ${skipped.length} ignored advisories`);
process.exit(blocking.length > 0 ? 1 : 0);

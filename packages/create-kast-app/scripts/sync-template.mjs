/**
 * Copy the workspace trees the scaffolder ships into `template/`.
 *
 * `template/` is a second copy of apps/api, apps/admin and packages/sdk that
 * `create-kast-app` writes verbatim into every generated project, so a fix that
 * stops at the repo edge protects nobody downstream. test/template-parity.test.mjs
 * fails when the copies drift; this is the thing that resolves it.
 *
 *   node scripts/sync-template.mjs           # write
 *   node scripts/sync-template.mjs --check   # report only, exit 1 on drift
 *
 * Files listed in that test's SYNC_EXCEPTIONS are deliberately allowed to differ
 * and are skipped here, so running this never silently reverts one.
 */
import { cp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO = join(PKG, '..', '..');

const TREES = [
  ['apps/api/src', 'template/apps/api/src'],
  ['apps/api/prisma', 'template/apps/api/prisma'],
  ['apps/admin/src', 'template/apps/admin/src'],
  ['packages/sdk/src', 'template/packages/sdk/src'],
];

/** Kept in step with SYNC_EXCEPTIONS in test/template-parity.test.mjs. */
const SKIP = new Set();

/** Build output that can appear inside a source tree but is never shipped. */
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next']);

async function listFiles(dir, base = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await listFiles(join(dir, entry.name), rel)));
    else out.push(rel);
  }
  return out.sort();
}

async function readOrNull(path) {
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}

const check = process.argv.includes('--check');
let drifted = 0;

for (const [from, to] of TREES) {
  const source = join(REPO, from);
  const target = join(PKG, to);
  if (!(await stat(source).catch(() => null))) continue;

  const sourceFiles = await listFiles(source);
  const targetFiles = await listFiles(target).catch(() => []);

  for (const rel of sourceFiles) {
    if (SKIP.has(`${from}/${rel}`)) continue;
    const [a, b] = await Promise.all([readFile(join(source, rel)), readOrNull(join(target, rel))]);
    if (b !== null && a.equals(b)) continue;
    drifted += 1;
    console.log(`${check ? 'drift' : 'sync '}  ${to}/${rel}`);
    if (!check) {
      await mkdir(dirname(join(target, rel)), { recursive: true });
      await cp(join(source, rel), join(target, rel));
    }
  }

  for (const rel of targetFiles) {
    if (sourceFiles.includes(rel) || SKIP.has(`${from}/${rel}`)) continue;
    drifted += 1;
    console.log(`${check ? 'stale' : 'rm   '}  ${to}/${rel}`);
    if (!check) await rm(join(target, rel));
  }
}

if (drifted === 0) console.log('template is in sync');
else if (check) {
  console.log(`\n${drifted} file(s) drifted — run: pnpm --filter create-kast-app sync:template`);
  process.exit(1);
} else console.log(`\nsynced ${drifted} file(s)`);

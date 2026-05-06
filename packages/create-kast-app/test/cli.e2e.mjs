/**
 * E2E test for create-kast-app CLI.
 * Uses Node.js built-in test runner (node:test) — no extra test framework needed.
 *
 * Run after building:
 *   pnpm --filter create-kast-app build && node --test test/cli.e2e.mjs
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __dir = dirname(fileURLToPath(import.meta.url));
const CLI_BIN = join(__dir, '..', 'dist', 'index.js');

// Pass --skip-install so tests don't run pnpm/npm install (too slow for CI)
const SKIP_FLAGS = ['--skip-interactive', '--skip-install'];

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

test('--skip-interactive generates expected project structure', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'kast-e2e-'));
  const projectName = 'test-kast-project';
  const projectDir = join(tmp, projectName);

  t.after(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  await execFileAsync('node', [CLI_BIN, projectName, ...SKIP_FLAGS], { cwd: tmp });

  // Root config files
  const requiredFiles = [
    'package.json',
    'pnpm-workspace.yaml',
    'docker-compose.yml',
    '.env.example',
    '.env',
    'README.md',
    '.gitignore',
  ];
  for (const file of requiredFiles) {
    assert.ok(await exists(join(projectDir, file)), `Missing: ${file}`);
  }

  // Top-level directories
  for (const dir of ['apps', 'packages', 'plugins']) {
    assert.ok(await exists(join(projectDir, dir)), `Missing directory: ${dir}`);
  }

  // Real source files must be present (copied from template/)
  assert.ok(
    await exists(join(projectDir, 'apps', 'api', 'src', 'main.ts')),
    'apps/api/src/main.ts must exist',
  );
  assert.ok(await exists(join(projectDir, 'apps', 'admin', 'src')), 'apps/admin/src must exist');
  assert.ok(
    await exists(join(projectDir, 'packages', 'sdk', 'src')),
    'packages/sdk/src must exist',
  );
});

test('docker-compose.yml contains postgres and redis services', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'kast-e2e-'));
  t.after(async () => rm(tmp, { recursive: true, force: true }));

  await execFileAsync('node', [CLI_BIN, 'compose-test', ...SKIP_FLAGS], { cwd: tmp });

  const compose = await readFile(join(tmp, 'compose-test', 'docker-compose.yml'), 'utf-8');
  assert.ok(compose.includes('postgres'), 'docker-compose should include postgres service');
  assert.ok(compose.includes('redis'), 'docker-compose should include redis service');
  // Production images reference (Docker workflow — not the primary dev path)
  assert.ok(
    compose.includes('kast-api'),
    'docker-compose should reference kast-api image for production',
  );
});

test('.env.example contains required variables', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'kast-e2e-'));
  t.after(async () => rm(tmp, { recursive: true, force: true }));

  await execFileAsync('node', [CLI_BIN, 'env-test', ...SKIP_FLAGS], { cwd: tmp });

  const env = await readFile(join(tmp, 'env-test', '.env.example'), 'utf-8');
  const required = ['JWT_SECRET', 'DATABASE_URL', 'REDIS_HOST', 'SITE_URL'];
  for (const key of required) {
    assert.ok(env.includes(key), `.env.example should contain ${key}`);
  }
});

test('.env is created from .env.example', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'kast-e2e-'));
  t.after(async () => rm(tmp, { recursive: true, force: true }));

  await execFileAsync('node', [CLI_BIN, 'dot-env-test', ...SKIP_FLAGS], { cwd: tmp });

  const example = await readFile(join(tmp, 'dot-env-test', '.env.example'), 'utf-8');
  const dotenv = await readFile(join(tmp, 'dot-env-test', '.env'), 'utf-8');
  assert.equal(dotenv, example, '.env should be a copy of .env.example');
});

test('package.json is valid JSON with correct project name and turbo dev script', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'kast-e2e-'));
  t.after(async () => rm(tmp, { recursive: true, force: true }));

  const name = 'pkg-json-test';
  await execFileAsync('node', [CLI_BIN, name, ...SKIP_FLAGS], { cwd: tmp });

  const raw = await readFile(join(tmp, name, 'package.json'), 'utf-8');
  const pkg = JSON.parse(raw);
  assert.equal(pkg.name, name, 'package.json name should match project name');
  assert.ok(pkg.scripts?.['dev'], 'package.json should have a dev script');
  assert.ok(pkg.scripts['dev'].includes('turbo'), 'dev script should use turbo');
  assert.ok(pkg.scripts?.['db:migrate'], 'package.json should have db:migrate script');
});

test('--no-admin generates backend-only flat project', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'kast-e2e-'));
  const projectName = 'test-api-only';
  const projectDir = join(tmp, projectName);

  t.after(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  await execFileAsync('node', [CLI_BIN, projectName, ...SKIP_FLAGS, '--no-admin'], { cwd: tmp });

  const requiredFiles = [
    'package.json',
    'docker-compose.yml',
    '.env.example',
    '.env',
    'README.md',
    '.gitignore',
  ];
  for (const file of requiredFiles) {
    assert.ok(await exists(join(projectDir, file)), `Missing: ${file}`);
  }

  assert.ok(
    await exists(join(projectDir, 'src', 'main.ts')),
    'src/main.ts must exist (flat structure)',
  );

  assert.ok(
    !(await exists(join(projectDir, 'apps'))),
    'apps/ must NOT exist in backend-only mode',
  );
  assert.ok(
    !(await exists(join(projectDir, 'pnpm-workspace.yaml'))),
    'pnpm-workspace.yaml must NOT exist in backend-only mode',
  );

  const raw = await readFile(join(projectDir, 'package.json'), 'utf-8');
  const pkg = JSON.parse(raw);
  assert.equal(pkg.name, projectName, 'package.json name should match project name');
  assert.ok(pkg.scripts?.['dev'], 'package.json should have a dev script');
  assert.ok(pkg.scripts?.['db:migrate'], 'package.json should have db:migrate script');
  assert.ok(pkg.dependencies?.['@nestjs/core'], 'should have @nestjs/core');
});

test('--no-admin docker-compose excludes admin service', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'kast-e2e-'));
  t.after(async () => rm(tmp, { recursive: true, force: true }));

  await execFileAsync('node', [CLI_BIN, 'api-compose', ...SKIP_FLAGS, '--no-admin'], {
    cwd: tmp,
  });

  const compose = await readFile(join(tmp, 'api-compose', 'docker-compose.yml'), 'utf-8');
  assert.ok(compose.includes('postgres'), 'docker-compose should include postgres service');
  assert.ok(compose.includes('redis'), 'docker-compose should include redis service');
  assert.ok(compose.includes('kast-api'), 'docker-compose should reference kast-api image');
  assert.ok(!compose.includes('kast-admin'), 'docker-compose must NOT reference kast-admin');
});

test('exits with code 1 when project directory already exists', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'kast-e2e-'));
  t.after(async () => rm(tmp, { recursive: true, force: true }));

  // Create first project
  await execFileAsync('node', [CLI_BIN, 'existing-dir', ...SKIP_FLAGS], { cwd: tmp });

  // Try to create again — should fail
  try {
    await execFileAsync('node', [CLI_BIN, 'existing-dir', ...SKIP_FLAGS], { cwd: tmp });
    assert.fail('Expected CLI to exit with non-zero code');
  } catch (err) {
    assert.ok(err.code !== 0, 'Should exit with non-zero code when directory exists');
  }
});

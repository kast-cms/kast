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

  await execFileAsync('node', [CLI_BIN, projectName, '--skip-interactive'], { cwd: tmp });

  // Core files
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

  // Directories
  for (const dir of ['apps', 'packages', 'plugins']) {
    assert.ok(await exists(join(projectDir, dir)), `Missing directory: ${dir}`);
  }
});

test('docker-compose.yml contains postgres and redis services', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'kast-e2e-'));
  t.after(async () => rm(tmp, { recursive: true, force: true }));

  await execFileAsync('node', [CLI_BIN, 'compose-test', '--skip-interactive'], { cwd: tmp });

  const compose = await readFile(join(tmp, 'compose-test', 'docker-compose.yml'), 'utf-8');
  assert.ok(compose.includes('postgres'), 'docker-compose should include postgres service');
  assert.ok(compose.includes('redis'), 'docker-compose should include redis service');
  assert.ok(compose.includes('kasthq/api'), 'docker-compose should reference kasthq/api image');
});

test('.env.example contains required variables', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'kast-e2e-'));
  t.after(async () => rm(tmp, { recursive: true, force: true }));

  await execFileAsync('node', [CLI_BIN, 'env-test', '--skip-interactive'], { cwd: tmp });

  const env = await readFile(join(tmp, 'env-test', '.env.example'), 'utf-8');
  const required = ['JWT_SECRET', 'DATABASE_URL', 'REDIS_HOST', 'SITE_URL'];
  for (const key of required) {
    assert.ok(env.includes(key), `.env.example should contain ${key}`);
  }
});

test('.env is created from .env.example', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'kast-e2e-'));
  t.after(async () => rm(tmp, { recursive: true, force: true }));

  await execFileAsync('node', [CLI_BIN, 'dot-env-test', '--skip-interactive'], { cwd: tmp });

  const example = await readFile(join(tmp, 'dot-env-test', '.env.example'), 'utf-8');
  const dotenv = await readFile(join(tmp, 'dot-env-test', '.env'), 'utf-8');
  assert.equal(dotenv, example, '.env should be a copy of .env.example');
});

test('package.json is valid JSON with correct project name', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'kast-e2e-'));
  t.after(async () => rm(tmp, { recursive: true, force: true }));

  const name = 'pkg-json-test';
  await execFileAsync('node', [CLI_BIN, name, '--skip-interactive'], { cwd: tmp });

  const raw = await readFile(join(tmp, name, 'package.json'), 'utf-8');
  const pkg = JSON.parse(raw);
  assert.equal(pkg.name, name);
  assert.ok(pkg.scripts?.['dev'], 'package.json should have a dev script');
});

test('exits with code 1 when project directory already exists', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'kast-e2e-'));
  t.after(async () => rm(tmp, { recursive: true, force: true }));

  // Create first project
  await execFileAsync('node', [CLI_BIN, 'existing-dir', '--skip-interactive'], { cwd: tmp });

  // Try to create again — should fail
  try {
    await execFileAsync('node', [CLI_BIN, 'existing-dir', '--skip-interactive'], { cwd: tmp });
    assert.fail('Expected CLI to exit with non-zero code');
  } catch (err) {
    assert.ok(err.code !== 0, 'Should exit with non-zero code when directory exists');
  }
});

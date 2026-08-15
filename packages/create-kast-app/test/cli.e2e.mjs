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
const SCAFFOLD_MODULE = join(__dir, '..', 'dist', 'scaffold.js');

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

test('the generated pnpm project carries the settings its dependencies need', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'kast-e2e-'));
  const projectName = 'test-kast-pm-config';
  const projectDir = join(tmp, projectName);

  t.after(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  await execFileAsync('node', [CLI_BIN, projectName, ...SKIP_FLAGS], { cwd: tmp });

  // sharp's platform package declares its libvips binary as an optional peer,
  // and pnpm skips those unless told otherwise. Without this the project
  // installs cleanly and dies on first boot with ERR_DLOPEN_FAILED.
  const npmrc = await readFile(join(projectDir, '.npmrc'), 'utf-8');
  assert.match(npmrc, /auto-install-peers=true/);

  // Build permissions have to land where the pinned pnpm reads them: package.json
  // below 10, onlyBuiltDependencies at 10, allowBuilds at 11 — and pnpm 11 fails
  // the install outright when a package with a build script is listed neither way.
  const pkg = JSON.parse(await readFile(join(projectDir, 'package.json'), 'utf-8'));
  const major = Number.parseInt(pkg.packageManager.split('@')[1].split('.')[0], 10);
  const workspace = await readFile(join(projectDir, 'pnpm-workspace.yaml'), 'utf-8');

  // pnpm 9 does not link a package's optional dependencies into a peer-suffixed
  // instance, so sharp installs cleanly and then dies on first boot looking for
  // libvips. Hoisting is the workaround, and only pnpm 9 should carry it.
  if (major < 10) {
    assert.match(npmrc, /^node-linker=hoisted$/m, 'pnpm 9 needs hoisting for sharp');
  } else {
    assert.doesNotMatch(npmrc, /node-linker=hoisted/, 'pnpm 10+ links optional deps correctly');
  }

  if (major >= 11) {
    assert.match(workspace, /^allowBuilds:/m, 'pnpm 11 reads allowBuilds from the workspace file');
    assert.match(workspace, /^ {2}sharp: true$/m);
    assert.equal(pkg.pnpm, undefined, 'pnpm 11 ignores the package.json pnpm field');
  } else if (major === 10) {
    assert.match(workspace, /^onlyBuiltDependencies:/m);
    assert.equal(pkg.pnpm, undefined, 'pnpm 10 ignores the package.json pnpm field');
  } else {
    assert.ok(pkg.pnpm?.onlyBuiltDependencies?.includes('sharp'), 'pnpm 9 reads package.json');
    assert.doesNotMatch(workspace, /^(allowBuilds|onlyBuiltDependencies):/m);
  }
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

/** Every variable the scaffolder replaces with a per-project random value. */
const GENERATED_SECRETS = [
  'JWT_SECRET',
  'KAST_SECRET_ENCRYPTION_KEY',
  'POSTGRES_PASSWORD',
  'REDIS_PASSWORD',
];

const secretOf = (env, name) => new RegExp(`^${name}=(.*)$`, 'm').exec(env)?.[1];
const withoutSecrets = (env) =>
  GENERATED_SECRETS.reduce(
    (acc, name) => acc.replace(new RegExp(`^${name}=.*$`, 'm'), `${name}=`),
    env.replace(/^DATABASE_URL=.*$/m, 'DATABASE_URL='),
  ).replace(/^MEILISEARCH_MASTER_KEY=.*$/m, 'MEILISEARCH_MASTER_KEY=');

test('.env is created from .env.example with generated secrets', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'kast-e2e-'));
  t.after(async () => rm(tmp, { recursive: true, force: true }));

  await execFileAsync('node', [CLI_BIN, 'dot-env-test', ...SKIP_FLAGS], { cwd: tmp });

  const example = await readFile(join(tmp, 'dot-env-test', '.env.example'), 'utf-8');
  const dotenv = await readFile(join(tmp, 'dot-env-test', '.env'), 'utf-8');

  assert.equal(
    withoutSecrets(dotenv),
    withoutSecrets(example),
    `.env should match .env.example apart from ${GENERATED_SECRETS.join(', ')}`,
  );

  for (const name of GENERATED_SECRETS) {
    const secret = secretOf(dotenv, name);
    assert.ok(secret, `.env should define ${name}`);
    assert.notEqual(
      secret,
      secretOf(example, name),
      `${name} must not keep the placeholder from .env.example`,
    );
    // The API validates both with min(32) and refuses to boot below it.
    assert.ok(secret.length >= 32, `${name} must be at least 32 characters, got ${secret.length}`);
  }
  const postgresPassword = secretOf(dotenv, 'POSTGRES_PASSWORD');
  assert.ok(
    secretOf(dotenv, 'DATABASE_URL')?.includes(`:${postgresPassword}@`),
    'DATABASE_URL must use the generated POSTGRES_PASSWORD',
  );
});

test('each scaffolded project gets its own secrets', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'kast-e2e-'));
  t.after(async () => rm(tmp, { recursive: true, force: true }));

  await execFileAsync('node', [CLI_BIN, 'secret-a', ...SKIP_FLAGS], { cwd: tmp });
  await execFileAsync('node', [CLI_BIN, 'secret-b', ...SKIP_FLAGS], { cwd: tmp });

  const a = await readFile(join(tmp, 'secret-a', '.env'), 'utf-8');
  const b = await readFile(join(tmp, 'secret-b', '.env'), 'utf-8');
  for (const name of GENERATED_SECRETS) {
    assert.notEqual(secretOf(a, name), secretOf(b, name), `two projects must not share ${name}`);
  }
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

test('selected plugins, locales, and frontend starter change the generated source', async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), 'kast-options-'));
  const target = join(tmp, 'selected-project');
  t.after(async () => rm(tmp, { recursive: true, force: true }));
  const { scaffoldProject } = await import(SCAFFOLD_MODULE);

  await scaffoldProject(
    {
      projectName: 'selected-project',
      packageManager: 'pnpm',
      apiPort: 3100,
      includeAdmin: true,
      i18n: true,
      defaultLocale: 'en',
      extraLocales: ['fr', 'ja'],
      storageProvider: 'local',
      plugins: ['resend', 'sentry'],
      frontendStarter: 'blog',
      deployTarget: 'none',
    },
    target,
    { skipInstall: true },
  );

  assert.ok(await exists(join(target, 'plugins', 'kast-plugin-resend', 'src', 'index.ts')));
  assert.ok(await exists(join(target, 'plugins', 'kast-plugin-sentry', 'src', 'index.ts')));
  assert.equal(await exists(join(target, 'plugins', 'kast-plugin-stripe')), false);
  assert.ok(await exists(join(target, 'apps', 'web', 'src', 'app', 'page.tsx')));
  const env = await readFile(join(target, '.env.example'), 'utf8');
  assert.match(env, /^KAST_DEFAULT_LOCALE=en$/m);
  assert.match(env, /^KAST_INITIAL_LOCALES=en,fr,ja$/m);
});

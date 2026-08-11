/**
 * The scaffolder ships a second, complete copy of the API under `template/`, and
 * `create-kast-app` copies it verbatim into every generated project. A security
 * fix landed in `apps/api` therefore protects nothing downstream until the same
 * bytes reach `template/apps/api`. These tests are the enforcement of that: they
 * compare the two trees, and additionally pin the individual holes that were
 * found shipping in the template so a future partial sync cannot quietly
 * reintroduce one.
 *
 *   node --test test/template-parity.test.mjs
 */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const PKG = join(__dir, '..');
const REPO = join(PKG, '..', '..');

const API = join(REPO, 'apps', 'api');
const TEMPLATE_API = join(PKG, 'template', 'apps', 'api');

async function listFiles(dir, base = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await listFiles(join(dir, entry.name), rel)));
    else out.push(rel);
  }
  return out.sort();
}

function readTemplate(...segments) {
  return readFile(join(TEMPLATE_API, ...segments), 'utf-8');
}

/** The decorator run that starts at `@Method('path')`, up to the handler signature. */
function decoratorsFor(source, method, path) {
  const at = source.search(new RegExp(`@${method}\\('${path}'\\)`));
  if (at === -1) return null;
  const kept = [];
  for (const line of source.slice(at).split('\n')) {
    if (!/^\s*@/.test(line)) break;
    kept.push(line);
  }
  return kept.join('\n');
}

/** `{ missing, extra }` — a readable file-set delta, since deepEqual on 240 paths is not. */
function setDelta(expected, actual) {
  const a = new Set(actual);
  const e = new Set(expected);
  return {
    missing: expected.filter((f) => !a.has(f)),
    extra: actual.filter((f) => !e.has(f)),
  };
}

test('template/apps/api/src is byte-identical to apps/api/src', async () => {
  const [apiFiles, templateFiles] = await Promise.all([
    listFiles(join(API, 'src')),
    listFiles(join(TEMPLATE_API, 'src')),
  ]);

  assert.deepEqual(
    setDelta(apiFiles, templateFiles),
    { missing: [], extra: [] },
    'template/apps/api/src has drifted from apps/api/src',
  );

  const diverged = [];
  for (const rel of apiFiles) {
    const [a, b] = await Promise.all([
      readFile(join(API, 'src', rel), 'utf-8'),
      readFile(join(TEMPLATE_API, 'src', rel), 'utf-8'),
    ]);
    if (a !== b) diverged.push(rel);
  }

  assert.deepEqual(diverged, [], 'these API sources differ between apps/api and the template');
});

test('template/apps/api/prisma is byte-identical to apps/api/prisma', async () => {
  const [apiFiles, templateFiles] = await Promise.all([
    listFiles(join(API, 'prisma')),
    listFiles(join(TEMPLATE_API, 'prisma')),
  ]);
  assert.deepEqual(setDelta(apiFiles, templateFiles), { missing: [], extra: [] });

  for (const rel of apiFiles) {
    const [a, b] = await Promise.all([
      readFile(join(API, 'prisma', rel), 'utf-8'),
      readFile(join(TEMPLATE_API, 'prisma', rel), 'utf-8'),
    ]);
    assert.equal(a, b, `template/apps/api/prisma/${rel} differs from apps/api`);
  }
});

test('P0-01: no scaffolded management route reads content or media anonymously', async () => {
  for (const rel of [
    'src/modules/media/media.controller.ts',
    'src/modules/content/content.controller.ts',
    'src/modules/content-types/content-types.controller.ts',
  ]) {
    const source = await readTemplate(rel);
    assert.equal(
      /@Public\(\)/.test(source),
      false,
      `${rel} still marks a handler @Public() — anonymous GET returns records in every scaffolded project`,
    );
  }
});

test('P0-02: the scaffolded API enforces API-token scope and token expiry', async () => {
  const guard = await readTemplate('src/common/guards/token-policy.guard.ts');
  assert.match(guard, /READ_ONLY/);
  assert.match(guard, /SCOPED/);

  const appModule = await readTemplate('src/app.module.ts');
  assert.match(
    appModule,
    /provide:\s*APP_GUARD,\s*useClass:\s*TokenPolicyGuard/,
    'TokenPolicyGuard is not registered as a global guard in the template',
  );
  assert.ok(
    appModule.indexOf('JwtAuthGuard') < appModule.indexOf('TokenPolicyGuard'),
    'TokenPolicyGuard must be registered after JwtAuthGuard so req.user is populated',
  );

  const strategy = await readTemplate('src/modules/auth/strategies/api-token.strategy.ts');
  assert.match(strategy, /apiTokenScope/, 'the token scope is dropped before it reaches AuthUser');
  assert.match(strategy, /expiresAt/, 'an expired API token still authenticates');
});

test('P0-05: a scaffolded project has a reachable first login', async () => {
  const controller = await readTemplate('src/modules/auth/auth.controller.ts');
  assert.match(
    controller,
    /@Post\('setup'\)/,
    "the seed and the README point first-run users at POST /api/v1/auth/setup — the template's auth controller must implement it",
  );
  assert.match(controller, /@Get\('setup'\)/);

  for (const [method, route] of [
    ['Get', 'setup'],
    ['Post', 'setup'],
  ]) {
    assert.match(
      decoratorsFor(controller, method, route) ?? '',
      /@Public\(\)/,
      `${method.toUpperCase()} /auth/${route} must be @Public() — nobody can authenticate before it runs`,
    );
  }

  await readTemplate('src/modules/auth/dto/setup.dto.ts');

  const repository = await readTemplate('src/modules/auth/auth.repository.ts');
  assert.match(repository, /createInitialOwner/);
  assert.match(
    repository,
    /pg_advisory_xact_lock/,
    'concurrent setup calls must not both be able to create a super_admin',
  );

  // The seed creates no user, so the instruction it prints is the only documented
  // way in. It has to name a route the template actually serves.
  const seed = await readFile(join(TEMPLATE_API, 'prisma', 'seed.ts'), 'utf-8');
  assert.match(seed, /auth\/setup/);

  const setupPage = await readFile(
    join(PKG, 'template', 'apps', 'admin', 'src', 'app', 'setup', 'page.tsx'),
    'utf-8',
  );
  assert.match(setupPage, /\/api\/v1\/auth\/setup/);

  // A missing key makes next-intl throw while rendering, which on the setup page
  // means the first-run screen breaks at the moment it reports an error.
  const used = [...setupPage.matchAll(/\bt\('([a-zA-Z]+)'\)/g)].map((m) => m[1]);
  assert.ok(used.length > 0);
  for (const locale of ['en', 'ar']) {
    const messages = JSON.parse(
      await readFile(
        join(PKG, 'template', 'apps', 'admin', 'src', 'messages', `${locale}.json`),
        'utf-8',
      ),
    );
    assert.deepEqual(
      used.filter((key) => !(key in (messages.setup ?? {}))),
      [],
      `messages/${locale}.json is missing setup keys the page renders`,
    );
  }

  const middleware = await readFile(
    join(PKG, 'template', 'apps', 'admin', 'src', 'middleware.ts'),
    'utf-8',
  );
  assert.match(
    middleware,
    /'\/setup'/,
    'the admin middleware must let an unauthenticated visitor reach /setup',
  );
});

test('P0-06: scaffolded settings never hand back a stored secret', async () => {
  await readTemplate('src/modules/settings/settings-secret.util.ts');
  await readTemplate('src/common/utils/secret-crypto.util.ts');
  await readTemplate('src/common/utils/secret-key.util.ts');
  await readTemplate('src/common/utils/redact.util.ts');

  const service = await readTemplate('src/modules/settings/settings.service.ts');
  assert.match(service, /toSafeSetting/, 'getAll returns raw rows, secrets included');
  assert.match(service, /encryptSecret/, 'secret settings are stored in cleartext');
  assert.match(service, /decryptSecret/);

  const controller = await readTemplate('src/modules/settings/settings.controller.ts');
  assert.match(
    controller,
    /CurrentUser/,
    'getAll must know who is asking before it decides what to return',
  );
});

test('P0-09: entry lookups in the scaffolded API are bound to the route content type', async () => {
  const repository = await readTemplate('src/modules/content/content.repository.ts');
  for (const method of ['findByIdForType', 'findByIdWithFallbackForType', 'findVersionByIdForType'])
    assert.match(repository, new RegExp(method), `${method} is missing from the template`);

  assert.equal(
    /findUnique\(\{\s*where:\s*\{\s*id\s*\}/.test(repository),
    false,
    'an entry is still reachable by id alone, so any content-type slug in the path resolves it',
  );

  const service = await readTemplate('src/modules/content/content.service.ts');
  assert.match(service, /requireEntry/);
});

test('the generated .env satisfies the API env schema', async () => {
  const schema = await readFile(join(API, 'src', 'config', 'env.schema.ts'), 'utf-8');
  const envExample = await readFile(join(PKG, 'src', 'templates', 'env-example.ts'), 'utf-8');

  // Variables the schema length-checks. `KEY=` in the env file is the empty
  // string, not "unset", so an empty assignment fails validation outright and
  // the generated API refuses to boot — `.optional()` does not save it.
  const declarations = [
    ...schema.matchAll(/^ {2}([A-Z0-9_]+):([\s\S]*?)(?=^ {2}[A-Z0-9_]+:|^\}\);)/gm),
  ];
  const lengthChecked = declarations
    .filter(([, , body]) => body.includes('.min('))
    .map((m) => m[1]);

  assert.ok(lengthChecked.includes('KAST_SECRET_ENCRYPTION_KEY'));
  assert.ok(lengthChecked.includes('JWT_SECRET'));

  for (const name of lengthChecked) {
    assert.equal(
      new RegExp(`^${name}=\\s*$`, 'm').test(envExample),
      false,
      `.env.example assigns ${name} an empty value; the API's min-length check rejects it and the scaffolded project never starts`,
    );
  }
});

test('the generated README documents the real first-run path', async () => {
  const readme = await readFile(join(PKG, 'src', 'templates', 'readme.ts'), 'utf-8');
  assert.match(readme, /auth\/setup|admin\/setup/);
  assert.match(readme, /db:seed/);
  assert.match(readme, /SEED_ADMIN_EMAIL/, 'headless installs need a documented way in');
  assert.equal(
    /SEED_DEV_ACCOUNTS=1/.test(readme),
    false,
    'SEED_DEV_ACCOUNTS is an opt-in phrase, not a boolean — documenting "1" sends operators down a path that exits 1',
  );
});

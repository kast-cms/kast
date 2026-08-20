/**
 * The scaffolder ships a second, complete copy of the workspace under
 * `template/`, and `create-kast-app` copies it verbatim into every generated
 * project. A fix landed in `apps/api`, `apps/admin` or `packages/sdk` therefore
 * protects nothing downstream until the same bytes reach the template. These
 * tests are the enforcement of that: they compare the trees, and additionally
 * pin the individual holes that were found shipping in the template so a future
 * partial sync cannot quietly reintroduce one.
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
const TEMPLATE_ADMIN = join(PKG, 'template', 'apps', 'admin');
const TEMPLATE_SDK = join(PKG, 'template', 'packages', 'sdk');
const TEMPLATE_PLUGIN_SDK = join(PKG, 'template', 'packages', 'plugin-sdk');

/**
 * Trees the scaffolder ships verbatim. Every one of them is a second copy of a
 * workspace directory, so each must track its source byte for byte.
 *
 * `exceptions` is the ONLY sanctioned way for a template file to differ, and it
 * exists for files whose content is genuinely project-specific rather than
 * product code (generated config, package identity). Each entry has to carry
 * the reason it is allowed to drift — an entry with no reason is a check that
 * was dropped. Adding a path here silences a real fix from reaching every
 * generated project, so the bar is "this file cannot be the same by
 * construction", not "syncing it was inconvenient".
 */
const SYNCED_TREES = [
  { source: join(API, 'src'), template: join(TEMPLATE_API, 'src'), label: 'apps/api/src' },
  { source: join(API, 'prisma'), template: join(TEMPLATE_API, 'prisma'), label: 'apps/api/prisma' },
  {
    source: join(REPO, 'apps', 'admin', 'src'),
    template: join(TEMPLATE_ADMIN, 'src'),
    label: 'apps/admin/src',
  },
  {
    source: join(REPO, 'packages', 'sdk', 'src'),
    template: join(TEMPLATE_SDK, 'src'),
    label: 'packages/sdk/src',
  },
  {
    source: join(REPO, 'packages', 'sdk', 'test'),
    template: join(TEMPLATE_SDK, 'test'),
    label: 'packages/sdk/test',
  },
  {
    source: join(REPO, 'packages', 'plugin-sdk', 'src'),
    template: join(TEMPLATE_PLUGIN_SDK, 'src'),
    label: 'packages/plugin-sdk/src',
  },
  {
    source: join(API, 'test'),
    template: join(TEMPLATE_API, 'test'),
    label: 'apps/api/test',
  },
  {
    source: join(REPO, 'plugins'),
    template: join(PKG, 'template', 'plugins'),
    label: 'plugins',
  },
  {
    source: join(REPO, 'apps', 'web-blog'),
    template: join(PKG, 'template', 'starters', 'blog'),
    label: 'apps/web-blog',
  },
  {
    source: join(REPO, 'apps', 'web-docs'),
    template: join(PKG, 'template', 'starters', 'docs'),
    label: 'apps/web-docs',
  },
];

const SYNCED_FILES = [
  ['apps/api/package.json', 'template/apps/api/package.json'],
  ['apps/api/Dockerfile', 'template/apps/api/Dockerfile'],
  ['apps/api/prisma.config.ts', 'template/apps/api/prisma.config.ts'],
  ['apps/api/nest-cli.json', 'template/apps/api/nest-cli.json'],
  ['apps/api/tsconfig.build.json', 'template/apps/api/tsconfig.build.json'],
  ['apps/api/tsconfig.json', 'template/apps/api/tsconfig.json'],
  ['apps/admin/Dockerfile', 'template/apps/admin/Dockerfile'],
  ['apps/admin/eslint.config.ts', 'template/apps/admin/eslint.config.ts'],
  ['apps/admin/jest.config.cjs', 'template/apps/admin/jest.config.cjs'],
  ['apps/admin/next.config.ts', 'template/apps/admin/next.config.ts'],
  ['apps/admin/package.json', 'template/apps/admin/package.json'],
  ['apps/admin/postcss.config.mjs', 'template/apps/admin/postcss.config.mjs'],
  ['apps/admin/tsconfig.json', 'template/apps/admin/tsconfig.json'],
  ['packages/sdk/package.json', 'template/packages/sdk/package.json'],
  ['packages/sdk/tsconfig.json', 'template/packages/sdk/tsconfig.json'],
  ['packages/sdk/tsup.config.ts', 'template/packages/sdk/tsup.config.ts'],
  ['packages/plugin-sdk/package.json', 'template/packages/plugin-sdk/package.json'],
  ['packages/plugin-sdk/tsconfig.json', 'template/packages/plugin-sdk/tsconfig.json'],
  ['packages/plugin-sdk/tsup.config.ts', 'template/packages/plugin-sdk/tsup.config.ts'],
  ['eslint.config.ts', 'template/eslint.config.ts'],
];

/** `{ [tree label]: { [path relative to the tree]: why it may differ } }` */
/**
 * Files the template is allowed to differ on, as `{ tree: { path: reason } }`.
 *
 * Empty is the goal state. It last held apps/admin's two message files while
 * they were missing setup.errorPasswordMismatch and error.digest; apps/admin now
 * defines both, so the trees are back to strict byte parity.
 */
const SYNC_EXCEPTIONS = {};
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.turbo']);
const SKIP_FILES = new Set(['.env.local', 'AGENTS.md', 'CLAUDE.md']);

async function listFiles(dir, base = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    if (SKIP_FILES.has(entry.name)) continue;
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await listFiles(join(dir, entry.name), rel)));
    else out.push(rel);
  }
  return out.sort();
}

function readTemplate(...segments) {
  return readFile(join(TEMPLATE_API, ...segments), 'utf-8');
}

function readTemplateAdmin(...segments) {
  return readFile(join(TEMPLATE_ADMIN, ...segments), 'utf-8');
}

function readTemplateSdk(...segments) {
  return readFile(join(TEMPLATE_SDK, ...segments), 'utf-8');
}

async function exists(path) {
  try {
    await readFile(path, 'utf-8');
    return true;
  } catch {
    return false;
  }
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

for (const { source, template, label } of SYNCED_TREES) {
  test(`template/${label} is byte-identical to ${label}`, async () => {
    const exceptions = SYNC_EXCEPTIONS[label] ?? {};
    const [sourceFiles, templateFiles] = await Promise.all([
      listFiles(source),
      listFiles(template),
    ]);

    assert.deepEqual(
      setDelta(sourceFiles, templateFiles),
      { missing: [], extra: [] },
      `template/${label} has drifted from ${label}; a scaffolded project ships the missing/extra files above — run \`pnpm --filter create-kast-app sync:template\``,
    );

    const diverged = [];
    for (const rel of sourceFiles) {
      if (rel in exceptions) continue;
      // Buffers, not strings: these trees carry woff2 fonts, and decoding them
      // as UTF-8 folds every invalid sequence to U+FFFD — two different binaries
      // would compare equal.
      const [a, b] = await Promise.all([
        readFile(join(source, rel)),
        readFile(join(template, rel)),
      ]);
      if (!a.equals(b)) diverged.push(rel);
    }

    assert.deepEqual(
      diverged,
      [],
      `these files differ between ${label} and the template, so every scaffolded project gets the pre-fix copy — run \`pnpm --filter create-kast-app sync:template\``,
    );

    assert.deepEqual(
      Object.keys(exceptions).filter((rel) => !sourceFiles.includes(rel)),
      [],
      `${label} sync exceptions name files that no longer exist`,
    );
  });
}

for (const [source, template] of SYNCED_FILES) {
  test(`template/${template.replace(/^template\//, '')} matches ${source}`, async () => {
    const [actual, copied] = await Promise.all([
      readFile(join(REPO, source)),
      readFile(join(PKG, template)),
    ]);
    assert.ok(actual.equals(copied), `${template} has drifted from ${source}`);
  });
}

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
    join(PKG, 'template', 'apps', 'admin', 'src', 'proxy.ts'),
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
  await readTemplate('src/common/security/secret-encryption.service.ts');
  await readTemplate('src/common/utils/secret-crypto.util.ts');
  await readTemplate('src/common/utils/secret-key.util.ts');
  await readTemplate('src/common/utils/redact.util.ts');

  const service = await readTemplate('src/modules/settings/settings.service.ts');
  assert.match(service, /toSafeSetting/, 'getAll returns raw rows, secrets included');
  assert.match(service, /\bsecrets\.encrypt\(/, 'secret settings are stored in cleartext');
  assert.match(service, /decryptAndRotate/);

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

const LOCALES = ['en', 'ar'];

function readTemplateMessages(locale) {
  return readTemplateAdmin('src', 'messages', `${locale}.json`).then(JSON.parse);
}

/** Every leaf path in a messages tree, as `a.b.c`. */
function flattenMessages(node, prefix = '') {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === 'object'
      ? flattenMessages(value, path)
      : [[path, value]];
  });
}

test('the scaffolded admin messages differ from apps/admin only by added keys', async () => {
  // Byte parity above already forbids any divergence while SYNC_EXCEPTIONS is
  // empty. This stays as the key-level guard that survives if the message files
  // are ever excepted again: adding a key would be tolerable, changing the
  // translation of one apps/admin defines never is.
  for (const locale of LOCALES) {
    const [source, template] = await Promise.all([
      readFile(join(REPO, 'apps', 'admin', 'src', 'messages', `${locale}.json`), 'utf-8').then(
        JSON.parse,
      ),
      readTemplateMessages(locale),
    ]);

    const templateValues = new Map(flattenMessages(template));
    const changed = flattenMessages(source)
      .filter(([path, value]) => templateValues.get(path) !== value)
      .map(([path]) => path);

    assert.deepEqual(
      changed,
      [],
      `template messages/${locale}.json has drifted from apps/admin on these keys`,
    );
  }
});

test('the scaffolded admin renders only message keys it defines', async () => {
  // next-intl resolves `t('x')` against the namespace named in useTranslations,
  // so a key the page renders but no locale defines surfaces as a rendering
  // error on the very screen that was trying to report something.
  const adminSrc = join(TEMPLATE_ADMIN, 'src');
  const sources = (await listFiles(adminSrc)).filter((rel) => /\.tsx?$/.test(rel));
  const messages = new Map(
    await Promise.all(
      LOCALES.map(async (l) => [l, new Map(flattenMessages(await readTemplateMessages(l)))]),
    ),
  );

  const missing = [];
  for (const rel of sources) {
    const source = await readFile(join(adminSrc, rel), 'utf-8');
    // Bind each translator to the namespace it was declared with, so a file
    // holding two (`t` and `tc`) is checked against the right one. A translator
    // arriving as a prop has no declaration here and is left alone; an
    // identifier bound twice (two components in one file) is skipped rather
    // than guessed at, since a regex cannot tell the scopes apart.
    const bound = new Map();
    for (const [, ident, namespace] of source.matchAll(
      /const (\w+) = useTranslations\('([\w.]+)'\)/g,
    ))
      bound.set(ident, bound.has(ident) && bound.get(ident) !== namespace ? null : namespace);

    for (const [ident, namespace] of bound) {
      if (namespace === null) continue;
      for (const [, key] of source.matchAll(new RegExp(`\\b${ident}\\('([\\w.]+)'[,)]`, 'g'))) {
        for (const locale of LOCALES) {
          if (!messages.get(locale).has(`${namespace}.${key}`))
            missing.push(`${locale}: ${rel} renders ${namespace}.${key}`);
        }
      }
    }
  }

  assert.deepEqual(missing, [], 'these message keys are rendered but never defined');
});

test('the scaffolded admin and SDK manifests can install what their synced sources import', async () => {
  // A synced `src` is only as good as the manifest beside it: `globals.css`
  // importing tw-animate-css does nothing if the generated project never
  // installs it. Only the dependency maps are compared — everything else in a
  // manifest (scripts, metadata) is free to differ.
  for (const [label, source, template] of [
    ['apps/admin', join(REPO, 'apps', 'admin'), TEMPLATE_ADMIN],
    ['packages/sdk', join(REPO, 'packages', 'sdk'), TEMPLATE_SDK],
  ]) {
    const [a, b] = await Promise.all([
      readFile(join(source, 'package.json'), 'utf-8'),
      readFile(join(template, 'package.json'), 'utf-8'),
    ]).then((raw) => raw.map((json) => JSON.parse(json)));

    for (const field of ['dependencies', 'devDependencies']) {
      assert.deepEqual(
        b[field] ?? {},
        a[field] ?? {},
        `template/${label}/package.json ${field} has drifted from ${label}`,
      );
    }
  }
});

/**
 * Pathnames the admin has to serve before a session exists. `/login` and
 * `/setup` are the way in; the rest are derived below from the links the
 * scaffolded API hands to a browser, plus `/forgot-password`, which the login
 * card links to.
 */
const PRE_SESSION_ROUTES = ['/login', '/setup', '/forgot-password'];

/** The `PUBLIC_PATHS` set literal, read out of the admin middleware source. */
function publicPathsOf(middleware) {
  const literal = middleware.match(/PUBLIC_PATHS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
  assert.ok(literal, 'the admin middleware no longer declares a PUBLIC_PATHS set');
  return [...literal[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

test('AUTH-02/AUTH-05: every pre-session admin link the scaffolded API hands out resolves', async () => {
  // `${this.adminUrl}/reset-password`, `${base.pathname.replace(…)}/oauth-callback` — the
  // admin pathnames the API mails or redirects a browser to. Derived rather than
  // listed so a new link cannot be added without a page to land on.
  const linkSources = await Promise.all([
    readTemplate('src/modules/email/email.processor.ts'),
    readTemplate('src/modules/auth/auth.controller.ts'),
  ]);
  const handedOut = new Set(
    linkSources
      .flatMap((source) => [
        ...source.matchAll(/\$\{[^}]*(?:adminUrl|pathname)[^}]*\}(\/[a-z][a-z-]*)/g),
      ])
      .map((m) => m[1]),
  );

  assert.ok(
    handedOut.has('/reset-password') && handedOut.has('/accept-invite'),
    'the scaffolded API stopped mailing the recovery links this test is meant to guard',
  );

  const routes = [...new Set([...PRE_SESSION_ROUTES, ...handedOut])];
  const middleware = await readTemplateAdmin('src', 'proxy.ts');
  const publicPaths = publicPathsOf(middleware);

  const gated = routes.filter((route) => !publicPaths.includes(route));
  assert.deepEqual(
    gated,
    [],
    'the scaffolded admin middleware redirects these to /login before the page runs, dropping the token or OAuth code in the query string',
  );

  // A route in the allow-list still 404s without a page. Both layouts are flat,
  // so a route is either grouped under (auth) or sits at the app root.
  const missing = [];
  for (const route of routes) {
    const served =
      (await exists(join(TEMPLATE_ADMIN, 'src', 'app', '(auth)', route.slice(1), 'page.tsx'))) ||
      (await exists(join(TEMPLATE_ADMIN, 'src', 'app', route.slice(1), 'page.tsx')));
    if (!served) missing.push(route);
  }
  assert.deepEqual(missing, [], 'the scaffolded admin has no page for these routes');
});

test('the scaffolded admin never saves a setting the scaffolded API refuses to store', async () => {
  // PATCH /settings is all-or-nothing: one inert key in the batch throws before
  // the write, so a tab that sends one cannot save the enforced keys beside it.
  const catalog = await readTemplate('src/modules/settings/settings-catalog.ts');
  const inert = [...catalog.matchAll(/'([\w.]+)':\s*\{\s*enforcedBy:\s*null/g)].map((m) => m[1]);
  assert.ok(inert.length > 0, 'no inert keys parsed out of the settings catalog');

  const settingsDir = join(TEMPLATE_ADMIN, 'src', 'components', 'settings');
  const offenders = [];
  for (const rel of await listFiles(settingsDir)) {
    const source = await readFile(join(settingsDir, rel), 'utf-8');
    for (const key of inert) {
      if (source.includes(`key: '${key}'`)) offenders.push(`${rel} -> ${key}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'these scaffolded settings tabs PATCH a key the API rejects, so the whole batch 400s and the enforced keys beside it are discarded',
  );
});

test('the scaffolded SDK can express every publish option the scaffolded API accepts', async () => {
  const dto = await readTemplate('src/modules/content/dto/content-entry.dto.ts');
  assert.match(
    dto,
    /class PublishContentDto[\s\S]*?force\?: boolean/,
    'the scaffolded API no longer takes a publish override',
  );

  const client = await readTemplateSdk('src', 'client.ts');
  assert.match(
    client,
    /publish\(\s*typeSlug: string,\s*id: string,\s*body: PublishEntryBody/,
    'the scaffolded SDK publish() takes no body, so generated code calling publish(type, id, { force: true }) does not typecheck',
  );

  const types = await readTemplateSdk('src', 'types.ts');
  assert.match(types, /interface PublishEntryBody\b/);
  assert.match(
    await readTemplateSdk('src', 'index.ts'),
    /PublishEntryBody/,
    'PublishEntryBody is not exported, so a generated project cannot name the type',
  );
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

  // Password-reset, invite and OAuth-callback links are all minted from
  // ADMIN_URL. Leaving it out of the generated .env falls back to the schema
  // default, which mails localhost links from a deployed project.
  assert.match(
    envExample,
    /^ADMIN_URL=\S+\/admin$/m,
    'the generated .env must set ADMIN_URL including the admin base path',
  );

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

test('the scaffolder ships the monorepo security overrides', async () => {
  // Generated projects install the same transitive graph as the monorepo, so
  // a Dependabot pin that only lands in the root package.json protects nobody
  // downstream. This is the guard that keeps the baked list honest: the
  // monorepo's pnpm.overrides is the source of truth, the JSON the scaffolder
  // renders from must match it key for key.
  const repoPkg = JSON.parse(await readFile(join(REPO, 'package.json'), 'utf-8'));
  const baked = JSON.parse(
    await readFile(join(PKG, 'src', 'templates', 'security-overrides.json'), 'utf-8'),
  );
  assert.deepEqual(
    Object.keys(baked),
    Object.keys(repoPkg.pnpm?.overrides ?? {}),
    'the scaffolder override list drifted from the monorepo pnpm.overrides — copy the monorepo list into src/templates/security-overrides.json',
  );
  assert.deepEqual(baked, repoPkg.pnpm?.overrides ?? {});

  // pnpm >=10 run directly ignores package.json pnpm.* and reads only
  // pnpm-workspace.yaml; the pinned pnpm 9 runner is the reverse. The monorepo
  // therefore carries the pins in both places, and they must say exactly the
  // same thing or protection depends on which pnpm happened to run.
  const workspaceYaml = await readFile(join(REPO, 'pnpm-workspace.yaml'), 'utf-8');
  const overridesBlock = /^overrides:\n((?: {2}.*\n?)+)/m.exec(workspaceYaml)?.[1] ?? '';
  const yamlPins = Object.fromEntries(
    [...overridesBlock.matchAll(/^ {2}(?:'([^']+)'|([^':\n]+)): (.+)$/gm)].map((m) => [
      (m[1] ?? m[2]).trim(),
      m[3],
    ]),
  );
  assert.deepEqual(
    yamlPins,
    repoPkg.pnpm?.overrides ?? {},
    'pnpm-workspace.yaml overrides must mirror package.json pnpm.overrides exactly — direct pnpm >=10 runners read only the yaml copy',
  );
});

#!/usr/bin/env node
/**
 * Captures every admin screen in both light and dark themes into
 * docs/screenshots/, then regenerates docs/screenshots/README.md.
 *
 * Prerequisites — the full stack must already be running:
 *   1. Postgres + Redis
 *   2. `pnpm db:migrate && pnpm db:seed`
 *   3. the API on :3000   (`pnpm --filter @kast-cms/api dev`)
 *   4. the admin on :3001 (`pnpm --filter @kast-cms/admin dev`)
 *
 * Usage:
 *   node scripts/capture-screenshots.mjs
 *   node scripts/capture-screenshots.mjs --only=03-dashboard,11-media
 *
 * Environment:
 *   ADMIN_URL            default http://localhost:3001/admin
 *   API_URL              default http://localhost:3000/api/v1
 *   SCREENSHOT_EMAIL     default admin@kast.local
 *   SCREENSHOT_PASSWORD  default Admin1234!
 *   PLAYWRIGHT_CHROMIUM  explicit path to a Chromium binary, if autodetect fails
 */
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const OUT = path.join(REPO, 'docs', 'screenshots');

const ADMIN = process.env['ADMIN_URL'] ?? 'http://localhost:3001/admin';
const API = process.env['API_URL'] ?? 'http://localhost:3000/api/v1';
const CREDS = {
  email: process.env['SCREENSHOT_EMAIL'] ?? 'admin@kast.local',
  password: process.env['SCREENSHOT_PASSWORD'] ?? 'Admin1234!',
};

/** Tall enough that the full sidebar navigation fits without scrolling. */
const VIEWPORT = { width: 1440, height: 1024 };
const THEMES = ['light', 'dark'];

const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '').replace('--only=', '');
const onlySet = only ? new Set(only.split(',')) : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Optional deps, resolved leniently so a partial install still explains itself ── */
function loadPlaywright() {
  for (const id of ['playwright', 'playwright-core', '@playwright/test']) {
    try {
      return require(id);
    } catch {
      /* try the next one */
    }
  }
  throw new Error(
    'Playwright is not installed. Install it globally (`npm i -g playwright`) or add it as a dev dependency.',
  );
}

function loadSharp() {
  try {
    return require('sharp');
  } catch {
    return null; // optimisation is a nice-to-have, not a requirement
  }
}

/* ── Resolve real ids so deep links point at real records ─────────────────── */
async function resolveIds() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CREDS),
  });
  if (!res.ok) throw new Error(`API login failed (${res.status}) — is the API running on ${API}?`);
  const token = (await res.json()).data.accessToken;

  const get = async (p) => {
    const r = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return [];
    const j = await r.json();
    const body = Array.isArray(j) ? j : (j?.data ?? j);
    return Array.isArray(body) ? body : (body?.items ?? []);
  };

  const [entries, users, forms, menus, plugins] = await Promise.all([
    get('/content-types/blog_post/entries?limit=5'),
    get('/users?limit=5'),
    get('/forms'),
    get('/menus'),
    get('/plugins'),
  ]);

  return {
    entryId: entries[0]?.id ?? null,
    userId: users[0]?.id ?? null,
    formId: forms[0]?.id ?? null,
    menuId: menus[0]?.id ?? null,
    pluginName: plugins[0]?.name ?? null,
  };
}

/* ── Screen list ──────────────────────────────────────────────────────────── */
/** `all: true` ignores `--only`, so the index can still list every screen. */
function buildScreens(ids, all = false) {
  const screens = [
    { slug: '01-login', url: '/login', title: 'Sign in', auth: false },
    { slug: '02-forgot-password', url: '/forgot-password', title: 'Forgot password', auth: false },
    { slug: '03-dashboard', url: '/', title: 'Dashboard' },
    { slug: '04-content-types', url: '/content-types', title: 'Content types' },
    { slug: '05-content-type-new', url: '/content-types/new', title: 'New content type' },
    {
      slug: '06-content-type-detail',
      url: '/content-types/blog_post',
      title: 'Content type — field builder',
    },
    { slug: '07-content-hub', url: '/content', title: 'Content hub' },
    { slug: '08-entry-list', url: '/content/blog_post', title: 'Entry list' },
    { slug: '09-entry-new', url: '/content/blog_post/new', title: 'New entry' },
    ids.entryId && {
      slug: '10-entry-editor',
      url: `/content/blog_post/${ids.entryId}`,
      title: 'Entry editor',
    },
    { slug: '11-media', url: '/media', title: 'Media library' },
    { slug: '12-users', url: '/users', title: 'Users' },
    ids.userId && { slug: '13-user-detail', url: `/users/${ids.userId}`, title: 'Edit user' },
    { slug: '14-roles', url: '/roles', title: 'Roles & permissions' },
    { slug: '15-api-tokens', url: '/api-tokens', title: 'API tokens' },
    { slug: '16-agent-tokens', url: '/agent-tokens', title: 'Agent tokens' },
    { slug: '17-seo', url: '/seo', title: 'SEO overview' },
    { slug: '18-seo-redirects', url: '/seo/redirects', title: 'Redirects' },
    { slug: '19-seo-sitemap', url: '/seo/sitemap', title: 'Sitemap' },
    { slug: '20-webhooks', url: '/webhooks', title: 'Webhooks' },
    { slug: '21-forms', url: '/forms', title: 'Forms' },
    { slug: '22-form-new', url: '/forms/new', title: 'New form' },
    ids.formId && {
      slug: '23-form-builder',
      url: `/forms/${ids.formId}/edit`,
      title: 'Form builder',
    },
    ids.formId && {
      slug: '24-form-submissions',
      url: `/forms/${ids.formId}/submissions`,
      title: 'Form submissions',
    },
    { slug: '25-menus', url: '/menus', title: 'Menus' },
    ids.menuId && { slug: '26-menu-builder', url: `/menus/${ids.menuId}`, title: 'Menu builder' },
    { slug: '27-plugins', url: '/plugins', title: 'Plugins' },
    ids.pluginName && {
      slug: '28-plugin-detail',
      url: `/plugins/${ids.pluginName}`,
      title: 'Plugin detail',
    },
    { slug: '29-trash', url: '/trash', title: 'Trash' },
    { slug: '30-audit-log', url: '/audit-log', title: 'Audit log' },
    { slug: '31-settings', url: '/settings', title: 'Settings' },
    { slug: '32-locales', url: '/settings/locales', title: 'Locales' },
    { slug: '33-queues', url: '/queues', title: 'Queue monitor' },
    { slug: '34-not-found', url: '/this-route-does-not-exist', title: 'Not found' },
  ].filter(Boolean);

  return onlySet && !all ? screens.filter((s) => onlySet.has(s.slug)) : screens;
}

/** Captured a second time with the Arabic locale, to show the RTL layout. */
const RTL_SCREENS = [
  { slug: '40-rtl-dashboard', url: '/', title: 'Dashboard (Arabic, RTL)' },
  { slug: '41-rtl-entry-list', url: '/content/blog_post', title: 'Entry list (Arabic, RTL)' },
  { slug: '42-rtl-settings', url: '/settings', title: 'Settings (Arabic, RTL)' },
];

/* ── Page helpers ─────────────────────────────────────────────────────────── */
async function login(page) {
  await page.goto(`${ADMIN}/login`, { waitUntil: 'networkidle' });
  await page.fill('input#email', CREDS.email);
  await page.fill('input#password', CREDS.password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 30_000 }),
    page.click('button[type=submit]'),
  ]);
  await page.waitForLoadState('networkidle').catch(() => {});
}

/** Wait for the network, the webfonts and any in-flight animation to settle. */
async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page
    .waitForFunction(() => document.fonts?.status === 'loaded', { timeout: 5_000 })
    .catch(() => {});
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important}',
  });
  await sleep(600);
}

async function optimize(file, sharp) {
  if (!sharp) return (await fs.stat(file)).size;
  const buf = await fs.readFile(file);
  const out = await sharp(buf).png({ palette: true, quality: 82, effort: 8 }).toBuffer();
  if (out.length < buf.length) await fs.writeFile(file, out);
  return (await fs.stat(file)).size;
}

/* ── Index page ───────────────────────────────────────────────────────────── */
const GROUPS = [
  { title: 'Sign in', match: (s) => /^(01|02)-/.test(s.slug) },
  { title: 'Dashboard', match: (s) => /^03-/.test(s.slug) },
  { title: 'Content modelling', match: (s) => /^(04|05|06)-/.test(s.slug) },
  { title: 'Content', match: (s) => /^(07|08|09|10)-/.test(s.slug) },
  { title: 'Media', match: (s) => /^11-/.test(s.slug) },
  { title: 'Access control', match: (s) => /^(12|13|14|15|16)-/.test(s.slug) },
  { title: 'SEO', match: (s) => /^(17|18|19)-/.test(s.slug) },
  { title: 'Integrations & builders', match: (s) => /^(2[0-8])-/.test(s.slug) },
  { title: 'System', match: (s) => /^(29|3[0-4])-/.test(s.slug) },
  { title: 'Right-to-left (Arabic locale)', match: (s) => /^4[0-9]-/.test(s.slug) },
];

async function writeIndex(captured) {
  const files = new Set(await fs.readdir(OUT));
  const lines = [
    '# Admin panel screenshots',
    '',
    `Every screen of the Kast admin panel, in both themes, captured at ${VIEWPORT.width}×${VIEWPORT.height}.`,
    '',
    'Regenerate with `pnpm screenshots` while the stack is running — see',
    '[`scripts/capture-screenshots.mjs`](../../scripts/capture-screenshots.mjs) for the prerequisites.',
    '',
  ];

  for (const group of GROUPS) {
    const items = captured.filter(group.match);
    if (items.length === 0) continue;
    lines.push(`## ${group.title}`, '');
    for (const screen of items) {
      const light = `${screen.slug}-light.png`;
      const dark = `${screen.slug}-dark.png`;
      if (!files.has(light) && !files.has(dark)) continue;
      lines.push(`### ${screen.title}`, '');
      lines.push('| Light | Dark |', '| --- | --- |');
      const l = files.has(light) ? `![${screen.title} — light](./${light})` : '_not captured_';
      const d = files.has(dark) ? `![${screen.title} — dark](./${dark})` : '_not captured_';
      lines.push(`| ${l} | ${d} |`, '');
    }
  }

  await fs.writeFile(path.join(OUT, 'README.md'), lines.join('\n'));
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
async function main() {
  const { chromium } = loadPlaywright();
  const sharp = loadSharp();

  await fs.mkdir(OUT, { recursive: true });
  const ids = await resolveIds();
  const screens = buildScreens(ids);
  console.log(`Capturing ${screens.length} screens × ${THEMES.length} themes → ${OUT}`);

  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
  };
  if (process.env['PLAYWRIGHT_CHROMIUM'])
    launch.executablePath = process.env['PLAYWRIGHT_CHROMIUM'];
  const browser = await chromium.launch(launch);

  const captured = [];
  let failures = 0;
  let bytes = 0;

  for (const theme of THEMES) {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      colorScheme: theme,
      locale: 'en-US',
      timezoneId: 'UTC',
      reducedMotion: 'reduce',
    });
    // Runs before any page script, so the pre-paint theme script in
    // app/layout.tsx picks the theme up on the very first render.
    await context.addInitScript((t) => {
      try {
        window.localStorage.setItem('kast-theme', t);
        window.localStorage.setItem('kast-sidebar-collapsed', 'false');
      } catch {
        /* storage may be blocked; the colorScheme fallback still applies */
      }
    }, theme);

    const page = await context.newPage();

    const capture = async (screen) => {
      const file = path.join(OUT, `${screen.slug}-${theme}.png`);
      try {
        await page.goto(`${ADMIN}${screen.url}`, {
          waitUntil: 'domcontentloaded',
          timeout: 45_000,
        });
        await settle(page);
        await page.screenshot({ path: file, animations: 'disabled' });
        bytes += await optimize(file, sharp);
        if (theme === THEMES[0]) captured.push(screen);
        console.log(`  ✔ ${screen.slug}-${theme}`);
      } catch (err) {
        failures++;
        console.warn(`  ✖ ${screen.slug}-${theme}: ${String(err.message).split('\n')[0]}`);
      }
    };

    // Public screens first, while the context still has no session cookie.
    for (const screen of screens.filter((s) => s.auth === false)) await capture(screen);
    await login(page);
    for (const screen of screens.filter((s) => s.auth !== false)) await capture(screen);

    /*
     * Right-to-left pass. The admin ships an Arabic locale, so a few
     * representative screens are captured with dir="rtl" to show that the
     * logical-property layout and the Arabic webfont actually hold up.
     * Selecting the locale is just a cookie — see src/i18n/request.ts.
     */
    const rtlWanted = onlySet ? RTL_SCREENS.filter((s) => onlySet.has(s.slug)) : RTL_SCREENS;
    if (rtlWanted.length > 0) {
      await context.addCookies([
        { name: 'NEXT_LOCALE', value: 'ar', url: 'http://localhost:3001' },
      ]);
      for (const rtl of rtlWanted) {
        await capture(rtl);
      }
      await context.addCookies([
        { name: 'NEXT_LOCALE', value: 'en', url: 'http://localhost:3001' },
      ]);
    }

    await context.close();
  }

  await browser.close();

  /*
   * The index is rebuilt from the FULL screen list, not just this run's
   * captures, and each entry is kept only if its PNG exists on disk. That way a
   * targeted re-run (`--only=03-dashboard`) refreshes those images without
   * truncating the index down to the handful of screens it just shot.
   */
  await writeIndex([...buildScreens(ids, true), ...RTL_SCREENS]);

  const total = captured.length * THEMES.length - failures;
  console.log(
    `\nDone: ${total} images, ${(bytes / 1024 / 1024).toFixed(1)} MB${
      failures > 0 ? `, ${failures} failed` : ''
    }`,
  );
  if (failures > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

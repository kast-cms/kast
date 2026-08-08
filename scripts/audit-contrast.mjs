#!/usr/bin/env node
/**
 * WCAG contrast audit for the Kast design system.
 *
 * Parses the semantic tokens straight out of `apps/admin/src/app/globals.css`,
 * so it audits what actually ships rather than a copy that can drift. Every
 * foreground/background pair the UI actually renders is checked in both themes.
 *
 *   node scripts/audit-contrast.mjs
 *
 * Exits non-zero if any pair falls below its target, which makes it usable as
 * a CI gate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS = fs.readFileSync(path.join(REPO, 'apps/admin/src/app/globals.css'), 'utf8');

/* ── OKLCH → sRGB (Björn Ottosson) ────────────────────────────────────────── */
const linearToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

function oklchToRgb(L, C, H) {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b2 = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b2) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b2) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b2) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.min(1, Math.max(0, linearToSrgb(c))));
}

const relLuminance = ([r, g, b]) => {
  const f = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

function contrast(a, b) {
  const [hi, lo] = [relLuminance(a), relLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/* ── Parse a token block ──────────────────────────────────────────────────── */
function parseBlock(selector) {
  const body = CSS.match(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'))?.[1] ?? '';
  const tokens = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*oklch\(([^)]+)\)\s*;/g)) {
    const parts = m[2]
      .trim()
      .split(/[\s/]+/)
      .map(Number);
    // Skip anything with an alpha channel or a non-numeric component — those
    // are overlays, not text/background pairs.
    if (parts.length !== 3 || parts.some(Number.isNaN)) continue;
    tokens[m[1]] = oklchToRgb(parts[0], parts[1], parts[2]);
  }
  return tokens;
}

/*
 * [foreground, background, minimum ratio, description]
 *
 * 4.5 = WCAG AA for normal text.
 * 3.0 = AA for large text, icons and UI component boundaries.
 * 1.5 = a deliberately lower bar for decorative field borders, which are an
 *       affordance rather than information.
 */
const PAIRS = [
  ['foreground', 'background', 4.5, 'body text on page'],
  ['card-foreground', 'card', 4.5, 'body text on card'],
  ['popover-foreground', 'popover', 4.5, 'text in menus'],
  ['muted-foreground', 'background', 4.5, 'secondary text on page'],
  ['muted-foreground', 'card', 4.5, 'secondary text on card'],
  ['muted-foreground', 'muted', 4.5, 'text on muted fill'],
  ['primary-foreground', 'primary', 4.5, 'primary button label'],
  ['destructive-foreground', 'destructive', 4.5, 'destructive button label'],
  ['success-foreground', 'success', 4.5, 'success button label'],
  ['warning-foreground', 'warning', 4.5, 'warning chip label'],
  ['info-foreground', 'info', 4.5, 'info button label'],
  ['primary-subtle-foreground', 'primary-subtle', 4.5, 'brand chip'],
  ['success-subtle-foreground', 'success-subtle', 4.5, 'success chip'],
  ['warning-subtle-foreground', 'warning-subtle', 4.5, 'warning chip'],
  ['destructive-subtle-foreground', 'destructive-subtle', 4.5, 'destructive chip'],
  ['info-subtle-foreground', 'info-subtle', 4.5, 'info chip'],
  ['secondary-foreground', 'secondary', 4.5, 'secondary button label'],
  ['accent-foreground', 'accent', 4.5, 'hovered menu item'],
  ['primary', 'background', 3.0, 'brand text / icons on page'],
  ['primary', 'card', 3.0, 'brand text / icons on card'],
  ['destructive', 'card', 3.0, 'error text on card'],
  ['sidebar-foreground', 'sidebar', 4.5, 'sidebar nav label'],
  ['sidebar-muted-foreground', 'sidebar', 4.5, 'sidebar section heading'],
  ['sidebar-accent-foreground', 'sidebar-accent', 4.5, 'active sidebar item'],
  ['sidebar-primary', 'sidebar', 3.0, 'active sidebar icon'],
  ['ring', 'background', 3.0, 'focus ring on page'],
  ['border-strong', 'card', 1.5, 'field border on card'],
];

const THEMES = [
  ['LIGHT', parseBlock(':root')],
  ['DARK', parseBlock('\\.dark')],
];

let failures = 0;
for (const [name, tokens] of THEMES) {
  console.log(`\n── ${name} ${'─'.repeat(64 - name.length)}`);
  for (const [fg, bg, min, label] of PAIRS) {
    if (!tokens[fg] || !tokens[bg]) {
      console.log(`  ?  ${label.padEnd(30)} missing token (--${fg} / --${bg})`);
      failures++;
      continue;
    }
    const ratio = contrast(tokens[fg], tokens[bg]);
    const pass = ratio >= min;
    if (!pass) failures++;
    const level = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA large' : '—';
    console.log(
      `  ${pass ? '✔' : '✖'}  ${label.padEnd(30)} ${ratio.toFixed(2).padStart(5)}:1  (min ${min.toFixed(1)})  ${level}`,
    );
  }
}

console.log(
  failures === 0
    ? `\n✅ ${PAIRS.length * THEMES.length} token pairs all meet their contrast target`
    : `\n❌ ${failures} pair(s) below target`,
);
process.exit(failures === 0 ? 0 : 1);

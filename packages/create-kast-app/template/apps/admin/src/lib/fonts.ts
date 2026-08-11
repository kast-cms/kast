import localFont from 'next/font/local';

/*
 * Fonts are self-hosted rather than pulled from Google Fonts at build time.
 * Three reasons, in order of importance:
 *   1. `next build` works with no network, which matters for CI and Docker.
 *   2. No third-party request from an authenticated admin panel.
 *   3. The exact files are pinned in-repo, so type never shifts under us.
 *
 * All three faces are variable, so the whole 100–900 weight range costs one
 * file per family instead of one per weight.
 */

/** Inter — the UI face. Latin + Latin Extended so accented names render. */
export const fontSans = localFont({
  src: [
    { path: '../fonts/inter-variable.woff2', weight: '100 900', style: 'normal' },
    { path: '../fonts/inter-ext-variable.woff2', weight: '100 900', style: 'normal' },
  ],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
  fallback: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
});

/** JetBrains Mono — IDs, tokens, JSON payloads, slugs, code blocks. */
export const fontMono = localFont({
  src: [{ path: '../fonts/jetbrains-mono-variable.woff2', weight: '100 800', style: 'normal' }],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  preload: true,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
});

/*
 * Noto Sans Arabic backs the `ar` locale. It sits after Inter in the
 * `--font-sans` stack, so the browser falls through to it per glyph and no
 * locale-conditional class is needed. `preload: false` keeps its 162 KB off
 * the critical path for the Latin locales that never touch it.
 */
export const fontArabic = localFont({
  src: [{ path: '../fonts/noto-sans-arabic-variable.woff2', weight: '100 900', style: 'normal' }],
  variable: '--font-noto-arabic',
  display: 'swap',
  preload: false,
  fallback: ['Segoe UI', 'Tahoma', 'sans-serif'],
});

/** Every font variable, ready to drop on <html>. */
export const fontVariables = [fontSans.variable, fontMono.variable, fontArabic.variable].join(' ');

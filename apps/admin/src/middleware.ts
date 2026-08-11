import { type NextRequest, NextResponse } from 'next/server';

const REFRESH_COOKIE = process.env['REFRESH_TOKEN_COOKIE_NAME'] ?? 'kast_rt';

/**
 * Must match `basePath` in next.config.ts. Middleware sees the path with the
 * basePath already stripped, and a redirect built from it comes back out
 * without one — sending unauthenticated visitors to a 404 instead of the login
 * page — so it has to be put back explicitly.
 */
const BASE_PATH = process.env['NEXT_PUBLIC_ADMIN_BASE_PATH'] ?? '/admin';

/**
 * Paths that do NOT require authentication. Account recovery and the OAuth
 * hand-back are reachable only before a session exists, so gating them on the
 * refresh cookie makes them permanently unreachable.
 */
const PUBLIC_PATHS = new Set([
  '/login',
  '/setup',
  '/forgot-password',
  '/reset-password',
  '/accept-invite',
  '/oauth-callback',
]);

/** True when the path is one of the pre-session routes, with or without a trailing slash. */
export function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith('/api/')) return true;
  const normalized =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.replace(/\/+$/, '') : pathname;
  return PUBLIC_PATHS.has(normalized);
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Strip the basePath (/admin) — Next.js provides the path after basePath
  const isPublic = isPublicPath(pathname);

  if (!isPublic) {
    const hasRefreshCookie = request.cookies.has(REFRESH_COOKIE);
    if (!hasRefreshCookie) {
      const loginUrl = new URL(`${BASE_PATH}/login`, request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // No next-intl middleware here on purpose. Its middleware rewrites every
  // request to /<locale><pathname>, which only resolves when the App Router has
  // a [locale] segment. These routes are unprefixed (src/app/(auth), (dashboard),
  // setup), so that rewrite made every admin page 404. The locale is resolved
  // server-side in src/i18n/request.ts from the NEXT_LOCALE cookie instead.
  return NextResponse.next();
}

export const config = {
  // Match all paths except static files and Next.js internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

import createIntlMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';

const REFRESH_COOKIE = process.env['REFRESH_TOKEN_COOKIE_NAME'] ?? 'kast_rt';

/** Paths that do NOT require authentication */
const PUBLIC_PATHS = new Set(['/login', '/setup']);

const intlMiddleware = createIntlMiddleware({
  locales: ['en'],
  defaultLocale: 'en',
  localePrefix: 'never',
});

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Strip the basePath (/admin) — Next.js provides the path after basePath
  const isPublic = PUBLIC_PATHS.has(pathname) || pathname.startsWith('/api/');

  if (!isPublic) {
    const hasRefreshCookie = request.cookies.has(REFRESH_COOKIE);
    if (!hasRefreshCookie) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Run next-intl middleware for locale detection
  return intlMiddleware(request) as NextResponse;
}

export const config = {
  // Match all paths except static files and Next.js internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

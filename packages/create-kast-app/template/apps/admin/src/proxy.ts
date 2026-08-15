import { type NextRequest, NextResponse } from 'next/server';

const REFRESH_COOKIE = process.env['REFRESH_TOKEN_COOKIE_NAME'] ?? 'kast_rt';
const BASE_PATH = process.env['NEXT_PUBLIC_ADMIN_BASE_PATH'] ?? '/admin';

const PUBLIC_PATHS = new Set([
  '/login',
  '/setup',
  '/forgot-password',
  '/reset-password',
  '/accept-invite',
  '/oauth-callback',
]);

export function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith('/api/')) return true;
  const normalized =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.replace(/\/+$/, '') : pathname;
  return PUBLIC_PATHS.has(normalized);
}

/** Next.js 16 request proxy for pre-session route protection. */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  if (!isPublicPath(pathname) && !request.cookies.has(REFRESH_COOKIE)) {
    const loginUrl = new URL(`${BASE_PATH}/login`, request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

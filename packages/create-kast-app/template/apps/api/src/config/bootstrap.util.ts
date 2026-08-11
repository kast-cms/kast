/**
 * Pure helpers used by `bootstrap()`. They live outside main.ts because that
 * module invokes `bootstrap()` on import, so nothing can import a helper from
 * it without starting a server.
 */

/**
 * Translates TRUST_PROXY into the value Express expects. 'false'/'true' are
 * booleans, a bare integer is a hop count, and anything else is passed through
 * as an IP, CIDR or preset name ('loopback', 'uniquelocal', …).
 */
export function parseTrustProxy(raw: string): boolean | number | string {
  const value = raw.trim();
  if (value === '' || value.toLowerCase() === 'false') return false;
  if (value.toLowerCase() === 'true') return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

/**
 * `frame-ancestors` matches on origin — a path in the source expression is
 * ignored by browsers. ADMIN_URL carries the admin's whole public prefix
 * (`…:3001/admin`), so the path has to be stripped before it reaches the
 * directive; an unparseable value is passed through and left for helmet.
 */
export function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

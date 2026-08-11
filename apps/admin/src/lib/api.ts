import { API_URL } from '@/config/env';
import { KastClient } from '@kast-cms/sdk';

/**
 * Creates a KastClient instance for browser usage.
 * Pass the access token from session context.
 */
export function createApiClient(accessToken?: string): KastClient {
  return new KastClient({
    baseUrl: API_URL,
    ...(accessToken !== undefined ? { accessToken } : {}),
  });
}

/**
 * Server-side KastClient (uses INTERNAL_API_URL when available).
 * Import INTERNAL_API_URL from env only in server components.
 *
 * WARNING: management routes require authentication, and a server component
 * has no access token — the access token lives in client memory, and the only
 * server-readable credential is the httpOnly refresh cookie, which ROTATES on
 * use and would race the browser into a logout. Calling this without a token
 * yields 401 on every management route.
 *
 * Fetch from a client component with `createApiClient(session?.accessToken)`
 * (see `useApiResource`) unless you genuinely have a token to pass here.
 */
export function createServerApiClient(accessToken?: string): KastClient {
  const base =
    typeof process !== 'undefined'
      ? (process.env['INTERNAL_API_URL'] ??
        process.env['NEXT_PUBLIC_API_URL'] ??
        'http://localhost:3000')
      : API_URL;
  return new KastClient({ baseUrl: base, ...(accessToken !== undefined ? { accessToken } : {}) });
}

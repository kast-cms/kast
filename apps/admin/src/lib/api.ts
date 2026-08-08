import { API_URL } from '@/config/env';
import { KastClient } from '@kast-cms/sdk';

/*
 * This module is imported from BOTH server and client components, so it must
 * stay free of `'use client'` — marking it would make `createServerApiClient`
 * unavailable to server components. The React hook lives in
 * `lib/use-api-client.ts` instead.
 */

/**
 * Creates a KastClient instance for browser usage.
 * Pass the access token from session context.
 *
 * Note: this returns a NEW client on every call. Inside a component, prefer
 * `useApiClient()` — a fresh instance on each render makes any effect that
 * depends on the client re-run every render, which turns a single fetch into
 * an unbounded request loop.
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

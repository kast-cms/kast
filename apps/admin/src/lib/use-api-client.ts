'use client';

import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { KastClient } from '@kast-cms/sdk';
import { useMemo } from 'react';

/**
 * Memoised API client for client components.
 *
 * `createApiClient()` returns a new instance on every call, so listing it in a
 * `useEffect` dependency array re-runs the effect on every render — and if that
 * effect sets state, the result is an unbounded request loop that keeps firing
 * until the API rate-limits it. This keeps one instance per access token, which
 * makes the client safe to depend on.
 *
 * Lives in its own `'use client'` module so that `lib/api.ts` stays importable
 * from server components.
 */
export function useApiClient(): KastClient {
  const { session } = useSession();
  const accessToken = session?.accessToken;
  return useMemo(() => createApiClient(accessToken), [accessToken]);
}

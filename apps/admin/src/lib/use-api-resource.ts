'use client';

import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { KastClient } from '@kast-cms/sdk';
import { useEffect, useState } from 'react';

export interface ApiResource<T> {
  data: T | null;
  loading: boolean;
  failed: boolean;
}

/**
 * Loads a single resource from the API using the browser session's access
 * token.
 *
 * Management routes used to be anonymously readable, so several screens
 * fetched them from server components with no credential at all. Those routes
 * now require authentication, and the access token lives only in client memory
 * (the refresh token is httpOnly and rotates on use, so minting an access
 * token server-side would race the browser and log the user out). Fetching
 * from the client is therefore the only place the credential exists.
 *
 * The dashboard layout renders nothing until the session leaves `loading`, so
 * the token is already present on the first render of any page below it.
 *
 * `load` is deliberately excluded from the effect dependencies — callers pass
 * an inline lambda that is a new reference on every render. `key` is the
 * refetch trigger instead.
 */
export function useApiResource<T>(
  load: (client: KastClient) => Promise<T>,
  key: string,
): ApiResource<T> {
  const { session } = useSession();
  const token = session?.accessToken;
  const [state, setState] = useState<ApiResource<T>>({
    data: null,
    loading: true,
    failed: false,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, failed: false });

    load(createApiClient(token))
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ data: null, loading: false, failed: true });
      });

    return (): void => {
      cancelled = true;
    };
    // `load` is intentionally not a dependency; see the note above.
  }, [key, token]);

  return state;
}

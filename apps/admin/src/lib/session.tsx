'use client';

import { adminRoute } from '@/config/env';
import { createApiClient } from '@/lib/api';
import type { Session, SessionUser, TokenPair } from '@/types';
import type { KastClient } from '@kast-cms/sdk';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';

/* ── Context shape ──────────────────────────────────────────── */

interface SessionContextValue {
  session: Session | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  setSession: (pair: TokenPair) => void;
  clearSession: () => void;
  refreshSession: () => Promise<boolean>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/* ── Provider ───────────────────────────────────────────────── */

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps): JSX.Element {
  const [session, setSessionState] = useState<Session | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const refreshingRef = useRef(false);

  const buildSession = useCallback(
    (pair: TokenPair): Session => ({
      user: sessionUserFrom(pair),
      accessToken: pair.accessToken,
      expiresAt: Date.now() + pair.expiresIn * 1000,
    }),
    [],
  );

  const setSession = useCallback(
    (pair: TokenPair): void => {
      setSessionState(buildSession(pair));
      setStatus('authenticated');
    },
    [buildSession],
  );

  const clearSession = useCallback((): void => {
    setSessionState(null);
    setStatus('unauthenticated');
    void fetch(adminRoute('/api/auth/logout'), { method: 'POST' });
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (refreshingRef.current) return false;
    refreshingRef.current = true;
    try {
      const res = await fetch(adminRoute('/api/auth/refresh'), { method: 'POST' });
      if (!res.ok) {
        setSessionState(null);
        setStatus('unauthenticated');
        return false;
      }
      // The route handler wraps the pair as { data: TokenPair } — reading the
      // envelope as a bare TokenPair leaves accessToken undefined, which makes
      // expiresAt NaN and schedules an immediate re-refresh, rotating the
      // refresh token in a loop until the API rejects it and logs the user out.
      const json = (await res.json()) as { data: TokenPair };
      setSessionState(buildSession(json.data));
      setStatus('authenticated');
      return true;
    } catch {
      setSessionState(null);
      setStatus('unauthenticated');
      return false;
    } finally {
      refreshingRef.current = false;
    }
  }, [buildSession]);

  // Attempt silent refresh on mount
  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  // Proactive token refresh 60s before expiry
  useEffect(() => {
    if (status !== 'authenticated' || !session) return;
    const msUntilRefresh = session.expiresAt - Date.now() - 60_000;
    if (msUntilRefresh <= 0) {
      void refreshSession();
      return;
    }
    const timer = setTimeout(() => void refreshSession(), msUntilRefresh);
    return () => clearTimeout(timer);
  }, [session, status, refreshSession]);

  return (
    <SessionContext.Provider value={{ session, status, setSession, clearSession, refreshSession }}>
      {children}
    </SessionContext.Provider>
  );
}

/* ── Hook ───────────────────────────────────────────────────── */

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}

/**
 * The API client bound to the session's current access token.
 *
 * Always prefer this over calling `createApiClient(session?.accessToken)` in a
 * render body. That produced a fresh client every render, so any `useCallback`
 * that closed over it kept the client — and therefore the token — from the
 * render where the callback was memoized. Access tokens rotate every 15
 * minutes, so those callbacks went on presenting an expired token and every
 * action failed with a 401 until the page was reloaded.
 *
 * The identity returned here changes only when the token changes, so listing it
 * in a dependency array both fixes the staleness and keeps the array honest:
 * consumers must include `client` wherever they use it.
 */
export function useApiClient(): KastClient {
  const { session } = useSession();
  const token = session?.accessToken;
  return useMemo(() => createApiClient(token), [token]);
}

/* ── Session user ───────────────────────────────────────────── */

/**
 * Login and refresh both return the profile alongside the tokens; the access
 * token carries only sub/email/roles, so rebuilding the user from its claims
 * left firstName and lastName permanently null. The JWT is the fallback for a
 * response shape that predates `user`.
 */
function userFromClaims(payload: Record<string, unknown>): SessionUser {
  return {
    id: (payload['sub'] as string | undefined) ?? '',
    email: (payload['email'] as string | undefined) ?? '',
    firstName: (payload['firstName'] as string | null | undefined) ?? null,
    lastName: (payload['lastName'] as string | null | undefined) ?? null,
    roles: (payload['roles'] as string[] | undefined) ?? [],
  };
}

export function sessionUserFrom(pair: TokenPair): SessionUser {
  const claimed = userFromClaims(decodeJwtPayload(pair.accessToken));
  const user = pair.user as SessionUser | undefined;
  if (!user) return claimed;
  return {
    id: user.id || claimed.id,
    email: user.email || claimed.email,
    firstName: user.firstName ?? claimed.firstName,
    lastName: user.lastName ?? claimed.lastName,
    roles: user.roles.length ? user.roles : claimed.roles,
  };
}

/* ── JWT decode (no validation — server validates) ──────────── */

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const parts = token.split('.');
    const part = parts[1];
    if (!part) return {};
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

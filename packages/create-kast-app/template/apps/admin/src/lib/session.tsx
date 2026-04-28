'use client';

import type { Session, SessionUser, TokenPair } from '@/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

  const buildSession = useCallback((pair: TokenPair): Session => {
    const payload = decodeJwtPayload(pair.accessToken);
    const user: SessionUser = {
      id: (payload['sub'] as string | undefined) ?? '',
      email: (payload['email'] as string | undefined) ?? '',
      firstName: (payload['firstName'] as string | null | undefined) ?? null,
      lastName: (payload['lastName'] as string | null | undefined) ?? null,
      roles: (payload['roles'] as string[] | undefined) ?? [],
    };
    return {
      user,
      accessToken: pair.accessToken,
      expiresAt: Date.now() + pair.expiresIn * 1000,
    };
  }, []);

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
    void fetch('/api/auth/logout', { method: 'POST' });
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (refreshingRef.current) return false;
    refreshingRef.current = true;
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST' });
      if (!res.ok) {
        setSessionState(null);
        setStatus('unauthenticated');
        return false;
      }
      const json = (await res.json()) as TokenPair;
      setSessionState(buildSession(json));
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

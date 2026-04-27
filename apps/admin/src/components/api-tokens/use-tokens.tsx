'use client';

import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { ApiTokenCreated, ApiTokenSummary, CreateApiTokenBody } from '@kast/sdk';
import { useCallback, useEffect, useState } from 'react';

export interface UseTokensReturn {
  tokens: ApiTokenSummary[];
  loading: boolean;
  createdToken: ApiTokenCreated | null;
  create: (body: CreateApiTokenBody) => Promise<void>;
  revoke: (id: string) => Promise<void>;
  clearCreatedToken: () => void;
}

export function useTokens(): UseTokensReturn {
  const { session } = useSession();
  const client = createApiClient(session?.accessToken);

  const [tokens, setTokens] = useState<ApiTokenSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [createdToken, setCreatedToken] = useState<ApiTokenCreated | null>(null);

  const loadTokens = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await client.tokens.list();
      setTokens(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTokens();
  }, [loadTokens]);

  const create = useCallback(
    async (body: CreateApiTokenBody): Promise<void> => {
      const res = await client.tokens.create(body);
      setCreatedToken(res.data);
      void loadTokens();
    },
    [loadTokens],
  );

  const revoke = useCallback(
    async (id: string): Promise<void> => {
      await client.tokens.revoke(id);
      void loadTokens();
    },
    [loadTokens],
  );

  const clearCreatedToken = useCallback((): void => {
    setCreatedToken(null);
  }, []);

  return { tokens, loading, createdToken, create, revoke, clearCreatedToken };
}

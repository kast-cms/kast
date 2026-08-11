'use client';

import { useApiClient } from '@/lib/session';
import type { AgentTokenCreated, AgentTokenSummary, CreateAgentTokenBody } from '@kast-cms/sdk';
import { useCallback, useEffect, useState } from 'react';

export interface UseAgentTokensReturn {
  tokens: AgentTokenSummary[];
  loading: boolean;
  createdToken: AgentTokenCreated | null;
  create: (body: CreateAgentTokenBody) => Promise<void>;
  revoke: (id: string) => Promise<void>;
  clearCreatedToken: () => void;
}

export function useAgentTokens(): UseAgentTokensReturn {
  const client = useApiClient();

  const [tokens, setTokens] = useState<AgentTokenSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [createdToken, setCreatedToken] = useState<AgentTokenCreated | null>(null);

  const loadTokens = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await client.agentTokens.list();
      setTokens(res.data);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void loadTokens();
  }, [loadTokens]);

  const create = useCallback(
    async (body: CreateAgentTokenBody): Promise<void> => {
      const res = await client.agentTokens.create(body);
      setCreatedToken(res.data);
      void loadTokens();
    },
    [loadTokens, client],
  );

  const revoke = useCallback(
    async (id: string): Promise<void> => {
      await client.agentTokens.revoke(id);
      void loadTokens();
    },
    [loadTokens, client],
  );

  const clearCreatedToken = useCallback((): void => {
    setCreatedToken(null);
  }, []);

  return { tokens, loading, createdToken, create, revoke, clearCreatedToken };
}

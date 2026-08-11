'use client';

import { useToast } from '@/components/ui/use-toast';
import { useApiClient } from '@/lib/session';
import type { ApiTokenCreated, ApiTokenSummary, CreateApiTokenBody } from '@kast-cms/sdk';
import { useTranslations } from 'next-intl';
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
  const client = useApiClient();
  const { toast } = useToast();
  const t = useTranslations('apiTokens');

  const [tokens, setTokens] = useState<ApiTokenSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [createdToken, setCreatedToken] = useState<ApiTokenCreated | null>(null);

  const reportError = useCallback(
    (err: unknown): void => {
      toast({
        variant: 'destructive',
        title: t('errorTitle'),
        description: err instanceof Error ? err.message : t('loadError'),
      });
    },
    [toast, t],
  );

  const loadTokens = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await client.tokens.list();
      setTokens(res.data);
    } catch (err) {
      reportError(err);
    } finally {
      setLoading(false);
    }
  }, [reportError, client]);

  useEffect(() => {
    void loadTokens();
  }, [loadTokens]);

  const create = useCallback(
    async (body: CreateApiTokenBody): Promise<void> => {
      try {
        const res = await client.tokens.create(body);
        setCreatedToken(res.data);
        void loadTokens();
      } catch (err) {
        reportError(err);
        throw err;
      }
    },
    [loadTokens, reportError, client],
  );

  const revoke = useCallback(
    async (id: string): Promise<void> => {
      try {
        await client.tokens.revoke(id);
        void loadTokens();
      } catch (err) {
        reportError(err);
      }
    },
    [loadTokens, reportError, client],
  );

  const clearCreatedToken = useCallback((): void => {
    setCreatedToken(null);
  }, []);

  return { tokens, loading, createdToken, create, revoke, clearCreatedToken };
}

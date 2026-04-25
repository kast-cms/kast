'use client';

import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { CreateLocaleBody, LocaleSummary, UpdateLocaleBody } from '@kast/sdk';
import { useCallback, useEffect, useState } from 'react';

export interface UseLocalesReturn {
  locales: LocaleSummary[];
  loading: boolean;
  loadLocales: () => Promise<void>;
  createLocale: (body: CreateLocaleBody) => Promise<void>;
  updateLocale: (code: string, body: UpdateLocaleBody) => Promise<void>;
  deleteLocale: (code: string) => Promise<void>;
  setDefaultLocale: (code: string) => Promise<void>;
}

export function useLocales(): UseLocalesReturn {
  const { session } = useSession();
  const client = createApiClient(session?.accessToken);

  const [locales, setLocales] = useState<LocaleSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const loadLocales = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await client.locales.list();
      setLocales(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  const createLocale = useCallback(
    async (body: CreateLocaleBody): Promise<void> => {
      await client.locales.create(body);
      await loadLocales();
    },
    [loadLocales],
  );

  const updateLocale = useCallback(
    async (code: string, body: UpdateLocaleBody): Promise<void> => {
      await client.locales.update(code, body);
      await loadLocales();
    },
    [loadLocales],
  );

  const deleteLocale = useCallback(
    async (code: string): Promise<void> => {
      await client.locales.delete(code);
      await loadLocales();
    },
    [loadLocales],
  );

  const setDefaultLocale = useCallback(
    async (code: string): Promise<void> => {
      await client.locales.setDefault(code);
      await loadLocales();
    },
    [loadLocales],
  );

  useEffect(() => {
    void loadLocales();
  }, [loadLocales]);

  return {
    locales,
    loading,
    loadLocales,
    createLocale,
    updateLocale,
    deleteLocale,
    setDefaultLocale,
  };
}

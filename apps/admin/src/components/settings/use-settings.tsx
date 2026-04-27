'use client';

import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { GlobalSetting } from '@kast/sdk';
import { useCallback, useEffect, useState } from 'react';

export interface UseSettingsReturn {
  settings: GlobalSetting[];
  loading: boolean;
  saving: boolean;
  loadSettings: () => Promise<void>;
  patchSettings: (patches: { key: string; value: unknown }[]) => Promise<void>;
  testSmtp: (to: string) => Promise<{ success: boolean }>;
  testStorage: () => Promise<{ provider: string; status: string }>;
  getValue: (key: string) => unknown;
}

export function useSettings(): UseSettingsReturn {
  const { session } = useSession();
  const client = createApiClient(session?.accessToken);

  const [settings, setSettings] = useState<GlobalSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await client.settings.getAll();
      setSettings(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  const patchSettings = useCallback(
    async (patches: { key: string; value: unknown }[]): Promise<void> => {
      setSaving(true);
      try {
        const res = await client.settings.update({ settings: patches });
        setSettings((prev) => {
          const updated = new Map(res.data.map((s) => [s.key, s]));
          return prev
            .map((s) => updated.get(s.key) ?? s)
            .concat(res.data.filter((s) => !prev.some((p) => p.key === s.key)));
        });
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const testSmtp = useCallback(async (to: string): Promise<{ success: boolean }> => {
    return client.settings.testSmtp({ to });
  }, []);

  const testStorage = useCallback(async (): Promise<{ provider: string; status: string }> => {
    return client.settings.testStorage();
  }, []);

  const getValue = useCallback(
    (key: string): unknown => {
      return settings.find((s) => s.key === key)?.value;
    },
    [settings],
  );

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  return {
    settings,
    loading,
    saving,
    loadSettings,
    patchSettings,
    testSmtp,
    testStorage,
    getValue,
  };
}

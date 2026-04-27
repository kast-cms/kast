'use client';

import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { AuditLogEntry, AuditLogListParams, AuditLogMeta } from '@kast/sdk';
import { useEffect, useState } from 'react';

export interface UseAuditLogReturn {
  entries: AuditLogEntry[];
  meta: AuditLogMeta | null;
  loading: boolean;
  params: AuditLogListParams;
  setParams: (p: AuditLogListParams) => void;
}

export function useAuditLog(): UseAuditLogReturn {
  const { session } = useSession();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [meta, setMeta] = useState<AuditLogMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [params, setParamsState] = useState<AuditLogListParams>({ limit: 20 });

  useEffect(() => {
    const client = createApiClient(session?.accessToken);
    setLoading(true);
    client.audit
      .list(params)
      .then((res) => {
        setEntries(res.data);
        setMeta(res.meta);
      })
      .catch(() => {
        setEntries([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [session?.accessToken, params]);

  const setParams = (p: AuditLogListParams): void => {
    setParamsState(p);
  };

  return { entries, meta, loading, params, setParams };
}

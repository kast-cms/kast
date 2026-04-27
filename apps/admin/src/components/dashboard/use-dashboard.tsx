'use client';

import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { DashboardActivityEntry, DashboardQueueHealth, DashboardStats } from '@kast-cms/sdk';
import { useEffect, useRef, useState } from 'react';

export interface UseDashboardReturn {
  stats: DashboardStats | null;
  activity: DashboardActivityEntry[];
  queueHealth: DashboardQueueHealth[];
  loading: boolean;
  isAdmin: boolean;
  refetch: () => void;
}

const POLL_INTERVAL_MS = 10_000;

export function useDashboard(): UseDashboardReturn {
  const { session } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<DashboardActivityEntry[]>([]);
  const [queueHealth, setQueueHealth] = useState<DashboardQueueHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const isAdmin = session?.user.roles.some((r) => r === 'admin' || r === 'super_admin') ?? false;

  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!session?.accessToken) return;
    const client = createApiClient(session.accessToken);
    const requests: Array<Promise<void>> = [
      client.dashboard
        .getStats()
        .then(setStats)
        .catch(() => undefined),
      client.dashboard
        .getActivity()
        .then(setActivity)
        .catch(() => undefined),
    ];
    if (isAdmin) {
      requests.push(
        client.dashboard
          .getQueueHealth()
          .then(setQueueHealth)
          .catch(() => undefined),
      );
    }
    setLoading(true);
    void Promise.all(requests).finally(() => setLoading(false));
  }, [session?.accessToken, isAdmin, tick]);

  const refetch = (): void => setTick((t) => t + 1);

  return { stats, activity, queueHealth, loading, isAdmin, refetch };
}

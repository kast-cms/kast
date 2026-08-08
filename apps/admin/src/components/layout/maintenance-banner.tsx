'use client';

import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useState, type JSX } from 'react';

export function MaintenanceBanner(): JSX.Element | null {
  const { session } = useSession();
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!session?.accessToken) return;
    const client = createApiClient(session.accessToken);
    client.settings
      .getAll()
      .then((res) => {
        const setting = res.data.find((s) => s.key === 'site.maintenanceMode');
        setIsActive(setting?.value === true);
      })
      .catch(() => {
        // silently ignore — banner is non-critical
      });
  }, [session?.accessToken]);

  if (!isActive) return null;

  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-2 border-b border-warning/30 bg-warning-subtle px-6 py-2 text-sm text-warning-subtle-foreground"
    >
      <AlertTriangle className="size-4 shrink-0 text-warning" />
      <span>
        <strong className="font-semibold">Maintenance mode is active.</strong> Public API delivery
        routes are returning 503.
      </span>
    </div>
  );
}

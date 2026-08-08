'use client';

import { MaintenanceBanner } from '@/components/layout/maintenance-banner';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Spinner } from '@/components/ui/spinner';
import { useSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { useCallback, useEffect, useState, type JSX, type ReactNode } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
}

const SIDEBAR_STORAGE_KEY = 'kast-sidebar-collapsed';

export default function DashboardLayout({ children }: DashboardLayoutProps): JSX.Element {
  const { status } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
  }, [status]);

  // Restore the collapse preference after mount, so the server-rendered markup
  // and the first client render agree.
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true');
  }, []);

  const toggleSidebar = useCallback((): void => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  if (status === 'loading') {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar collapsed={collapsed} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar collapsed={collapsed} onToggleSidebar={toggleSidebar} />
        <MaintenanceBanner />
        <main className="flex-1 overflow-y-auto">
          <div className="page-container">{children}</div>
        </main>
      </div>
    </div>
  );
}

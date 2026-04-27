'use client';

import { MaintenanceBanner } from '@/components/layout/maintenance-banner';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Spinner } from '@/components/ui/spinner';
import { useSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { useEffect, type JSX, type ReactNode } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps): JSX.Element {
  const { status } = useSession();

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
  }, [status]);

  if (status === 'loading') {
    return (
      <div className="grid min-h-screen place-items-center bg-[--color-background]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[--color-background]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <MaintenanceBanner />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

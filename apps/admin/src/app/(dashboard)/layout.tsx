'use client';

import { MaintenanceBanner } from '@/components/layout/maintenance-banner';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { useSession } from '@/lib/session';
import { redirect, usePathname } from 'next/navigation';
import { useCallback, useEffect, useState, type JSX, type ReactNode } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
}

const SIDEBAR_STORAGE_KEY = 'kast-sidebar-collapsed';

export default function DashboardLayout({ children }: DashboardLayoutProps): JSX.Element {
  const { status } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = (): void => {
      setIsMobile(query.matches);
      if (!query.matches) setMobileOpen(false);
    };
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

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
    if (isMobile) {
      setMobileOpen((open) => !open);
      return;
    }
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  }, [isMobile]);

  if (status === 'loading') {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden h-full md:block">
        <Sidebar collapsed={collapsed} />
      </div>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 p-0" aria-describedby={undefined}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar collapsed={false} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          collapsed={isMobile ? !mobileOpen : collapsed}
          onToggleSidebar={toggleSidebar}
          {...(pathname === '/account' ? { title: 'Account security' } : {})}
        />
        <MaintenanceBanner />
        <main className="flex-1 overflow-y-auto">
          <div className="page-container">{children}</div>
        </main>
      </div>
    </div>
  );
}

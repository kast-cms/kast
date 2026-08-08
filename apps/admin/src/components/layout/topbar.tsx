'use client';

import { findNavItem } from '@/components/layout/nav-config';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Hint } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, type JSX } from 'react';

interface TopbarProps {
  /** Overrides the label derived from the current route. */
  title?: string;
  collapsed: boolean;
  onToggleSidebar: () => void;
}

/** Turns `/content/blog/123` into `['Content', 'blog', '123']`. */
function useBreadcrumb(pathname: string, fallback?: string): string[] {
  const t = useTranslations('nav');
  return useMemo(() => {
    const match = findNavItem(pathname);
    const root = match ? t(match.labelKey) : (fallback ?? 'Dashboard');
    if (!match || match.href === '/') return [root];

    const rest = pathname
      .slice(match.href.length)
      .split('/')
      .filter((segment) => segment !== '');

    return [root, ...rest];
  }, [pathname, fallback, t]);
}

export function Topbar({ title, collapsed, onToggleSidebar }: TopbarProps): JSX.Element {
  const pathname = usePathname();
  const crumbs = useBreadcrumb(pathname, title);
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl-K focuses search from anywhere in the app.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
      <Hint label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} side="bottom">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="rtl:rotate-180" />
          ) : (
            <PanelLeftClose className="rtl:rotate-180" />
          )}
        </Button>
      </Hint>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1.5 text-sm">
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <li key={`${crumb}-${index}`} className="flex min-w-0 items-center gap-1.5">
                {index > 0 && (
                  <span aria-hidden="true" className="text-border-strong select-none">
                    /
                  </span>
                )}
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={cn(
                    'truncate',
                    isLast ? 'font-semibold text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {crumb}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Search is presentational for now — the shortcut and affordance exist so
          the shell is complete; wiring it to the search API is a separate change. */}
      <div className="relative hidden items-center md:flex">
        <Search className="pointer-events-none absolute start-2.5 size-3.5 text-muted-foreground" />
        <input
          ref={searchRef}
          type="search"
          placeholder="Search…"
          aria-label="Search"
          className={cn(
            'h-8 w-48 rounded-md border border-input bg-card ps-8 pe-14 text-sm',
            'transition-[width,border-color,box-shadow] duration-200 ease-out-quad focus:w-64',
            'placeholder:text-muted-foreground/80',
            'outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25',
          )}
        />
        <span className="pointer-events-none absolute end-2 flex gap-0.5">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </div>

      <ThemeToggle />
    </header>
  );
}

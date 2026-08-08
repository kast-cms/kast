'use client';

import { visibleNavGroups, type NavGroup, type NavLinkItem } from '@/components/layout/nav-config';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Hint } from '@/components/ui/tooltip';
import { useSession } from '@/lib/session';
import { cn, getInitials } from '@/lib/utils';
import type { SessionUser } from '@/types';
import { ChevronsUpDown, LogOut, Settings, UserRound } from 'lucide-react';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { JSX } from 'react';
import { KastLogo } from './kast-logo';

interface NavItemProps {
  item: NavLinkItem;
  label: string;
  active: boolean;
  collapsed: boolean;
}

function NavItem({ item, label, active, collapsed }: NavItemProps): JSX.Element {
  const { href, Icon } = item;

  const link = (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium',
        'transition-colors duration-150 ease-out-quad',
        'outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
        collapsed && 'justify-center px-0',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-2xs'
          : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
      )}
    >
      {/* Active rail on the inline start edge — reads instantly in a long list
          and survives collapse, where the label is gone. */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-1.5 -start-2 w-0.5 rounded-full bg-sidebar-primary transition-transform duration-200 ease-spring',
          active ? 'scale-y-100' : 'scale-y-0',
        )}
      />
      <Icon
        className={cn(
          'size-4 shrink-0 transition-colors',
          active
            ? 'text-sidebar-primary'
            : 'text-sidebar-muted-foreground group-hover:text-current',
        )}
      />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );

  return collapsed ? (
    <Hint label={label} side="right">
      {link}
    </Hint>
  ) : (
    link
  );
}

/** Logo lockup. Collapses to the mark alone when the rail is narrow. */
function SidebarBrand({ collapsed }: { collapsed: boolean }): JSX.Element {
  return (
    <div
      className={cn(
        'flex h-14 shrink-0 items-center border-b border-sidebar-border',
        collapsed ? 'justify-center px-2' : 'px-4',
      )}
    >
      <Link
        href={'/' as Route}
        className={cn(
          'flex items-center gap-2.5 rounded-md outline-none',
          'focus-visible:ring-2 focus-visible:ring-sidebar-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
        )}
      >
        <KastLogo className="size-7 shrink-0" />
        {!collapsed && (
          <span className="text-md font-semibold tracking-tight text-sidebar-foreground">
            Kast<span className="text-sidebar-muted-foreground"> CMS</span>
          </span>
        )}
      </Link>
    </div>
  );
}

interface SidebarNavProps {
  groups: NavGroup[];
  collapsed: boolean;
  isActive: (href: Route) => boolean;
  label: (key: string) => string;
}

function SidebarNav({ groups, collapsed, isActive, label }: SidebarNavProps): JSX.Element {
  return (
    <nav
      className={cn('flex-1 overflow-y-auto py-3', collapsed ? 'px-2' : 'px-4')}
      aria-label="Main navigation"
    >
      {groups.map((group) => (
        <div key={group.labelKey} className="mb-5 last:mb-0">
          {/* Collapsed, the section headings would not fit, so a rule carries
              the same grouping information instead. */}
          {collapsed ? (
            <div className="mx-2 mb-2 h-px bg-sidebar-border first:hidden" aria-hidden="true" />
          ) : (
            <p className="mb-1.5 px-2.5 text-2xs font-semibold tracking-wider text-sidebar-muted-foreground uppercase">
              {label(`groups.${group.labelKey}`)}
            </p>
          )}
          <ul role="list" className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavItem
                  item={item}
                  label={label(item.labelKey)}
                  active={isActive(item.href)}
                  collapsed={collapsed}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

interface SidebarAccountProps {
  email: string;
  displayName: string;
  initials: string;
  collapsed: boolean;
  logoutLabel: string;
  onLogout: () => void;
}

function SidebarAccount({
  email,
  displayName,
  initials,
  collapsed,
  logoutLabel,
  onLogout,
}: SidebarAccountProps): JSX.Element {
  return (
    <div className={cn('shrink-0 border-t border-sidebar-border p-2', collapsed && 'px-2')}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md p-1.5 text-sm transition-colors',
              'hover:bg-sidebar-accent/60',
              'outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
              collapsed && 'justify-center',
            )}
          >
            <Avatar size="sm">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 text-start">
                  <span className="block truncate font-medium text-sidebar-foreground">
                    {displayName}
                  </span>
                  {/* The access token carries no name, so `displayName` often *is*
                      the email — only show the second line when it differs. */}
                  {displayName !== email && (
                    <span className="block truncate text-xs text-sidebar-muted-foreground">
                      {email}
                    </span>
                  )}
                </span>
                <ChevronsUpDown className="size-3.5 shrink-0 text-sidebar-muted-foreground" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuLabel>{email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={'/settings' as Route}>
              <UserRound />
              Account
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={'/settings' as Route}>
              <Settings />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onLogout}>
            <LogOut />
            {logoutLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * Full name when the session has one, email otherwise. The access token only
 * carries `sub`, `email` and `roles`, so in practice this is usually the email.
 */
function accountName(user: SessionUser): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
}

/**
 * The dashboard lives at '/', so it must match exactly — a prefix test would
 * light it up on every route in the app.
 */
function matchesRoute(pathname: string, href: Route): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps): JSX.Element {
  const pathname = usePathname();
  const { session, clearSession } = useSession();
  const t = useTranslations('nav');
  const tAuth = useTranslations('auth');

  const isSuperAdmin = session?.user.roles.includes('super_admin') ?? false;
  const navGroups = visibleNavGroups(isSuperAdmin);

  const isActive = (href: Route): boolean => matchesRoute(pathname, href);

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        'flex h-full shrink-0 flex-col border-e border-sidebar-border bg-sidebar',
        'transition-[width] duration-200 ease-out-quad',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <SidebarBrand collapsed={collapsed} />
      <SidebarNav
        groups={navGroups}
        collapsed={collapsed}
        isActive={isActive}
        label={(key) => t(key)}
      />
      {session && (
        <SidebarAccount
          email={session.user.email}
          displayName={accountName(session.user)}
          initials={getInitials(session.user.firstName, session.user.lastName)}
          collapsed={collapsed}
          logoutLabel={tAuth('logout')}
          onLogout={clearSession}
        />
      )}
    </aside>
  );
}

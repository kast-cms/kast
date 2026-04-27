'use client';
import type { JSX } from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSession } from '@/lib/session';
import { cn, getInitials } from '@/lib/utils';
import {
  BookOpen,
  Bot,
  Database,
  FileText,
  Globe,
  Image as ImageIcon,
  Key,
  Languages,
  LayoutDashboard,
  ListTree,
  LogOut,
  MonitorDot,
  Puzzle,
  ScrollText,
  Settings,
  Shield,
  Trash2,
  Users,
  Webhook,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavGroup {
  label: string;
  items: NavLinkItem[];
}

interface NavLinkItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

function useNavGroups(isSuperAdmin: boolean): NavGroup[] {
  const t = useTranslations('nav');
  return [
    {
      label: 'Overview',
      items: [{ href: '/', label: t('dashboard'), Icon: LayoutDashboard }],
    },
    {
      label: 'Content',
      items: [
        { href: '/content-types', label: t('contentTypes'), Icon: Database },
        { href: '/content', label: t('content'), Icon: FileText },
        { href: '/media', label: t('media'), Icon: ImageIcon },
      ],
    },
    {
      label: 'Access',
      items: [
        { href: '/users', label: t('users'), Icon: Users },
        { href: '/roles', label: t('roles'), Icon: Shield },
        { href: '/api-tokens', label: t('apiTokens'), Icon: Key },
        { href: '/agent-tokens', label: t('agentTokens'), Icon: Bot },
      ],
    },
    {
      label: 'Publishing',
      items: [
        { href: '/seo', label: t('seo'), Icon: Globe },
        { href: '/webhooks', label: t('webhooks'), Icon: Webhook },
        { href: '/forms', label: t('forms'), Icon: BookOpen },
        { href: '/menus', label: t('menus'), Icon: ListTree },
      ],
    },
    {
      label: 'System',
      items: [
        { href: '/plugins', label: t('plugins'), Icon: Puzzle },
        { href: '/trash', label: t('trash'), Icon: Trash2 },
        { href: '/audit-log', label: t('auditLog'), Icon: ScrollText },
        { href: '/settings/locales', label: t('locales'), Icon: Languages },
        { href: '/settings', label: t('settings'), Icon: Settings },
        ...(isSuperAdmin ? [{ href: '/queues', label: t('queueMonitor'), Icon: MonitorDot }] : []),
      ],
    },
  ];
}

export function Sidebar(): JSX.Element {
  const pathname = usePathname();
  const { session, clearSession } = useSession();
  const isSuperAdmin = session?.user.roles.includes('super_admin') ?? false;
  const navGroups = useNavGroups(isSuperAdmin);
  const t = useTranslations('auth');

  const isActive = (href: string): boolean => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="flex h-full w-60 flex-col border-e border-[--color-sidebar-border] bg-[--color-sidebar]">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-[--color-sidebar-border] px-4">
        <Link
          href="/content-types"
          className="flex items-center gap-2 font-semibold text-[--color-sidebar-foreground]"
        >
          <LayoutDashboard className="h-5 w-5 text-[--color-sidebar-primary]" />
          <span>Kast CMS</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3" aria-label="Main navigation">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="mb-1 px-4 text-xs font-semibold uppercase tracking-wider text-[--color-muted-foreground]">
              {group.label}
            </p>
            <ul role="list">
              {group.items.map(({ href, label, Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      'flex items-center gap-3 rounded-md mx-2 px-3 py-2 text-sm font-medium transition-colors',
                      isActive(href)
                        ? 'bg-[--color-sidebar-accent] text-[--color-sidebar-accent-foreground]'
                        : 'text-[--color-sidebar-foreground] hover:bg-[--color-sidebar-accent]/50 hover:text-[--color-sidebar-accent-foreground]',
                    )}
                    aria-current={isActive(href) ? 'page' : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* User section */}
      {session && (
        <div className="border-t border-[--color-sidebar-border] p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-[--color-sidebar-accent]/50 transition-colors"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback>
                    {getInitials(session.user.firstName, session.user.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden text-start">
                  <p className="truncate font-medium text-[--color-sidebar-foreground]">
                    {session.user.firstName ?? session.user.email}
                  </p>
                  <p className="truncate text-xs text-[--color-muted-foreground]">
                    {session.user.email}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-52">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={clearSession}
                className="text-[--color-destructive] focus:text-[--color-destructive]"
              >
                <LogOut className="h-4 w-4" />
                {t('logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </aside>
  );
}

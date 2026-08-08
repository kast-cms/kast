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
  MonitorDot,
  Puzzle,
  ScrollText,
  Settings,
  Shield,
  Trash2,
  Users,
  Webhook,
} from 'lucide-react';
import type { Route } from 'next';
import type { ComponentType } from 'react';

export interface NavLinkItem {
  href: Route;
  /** Key under the `nav` message namespace. */
  labelKey: string;
  Icon: ComponentType<{ className?: string }>;
  /** Only rendered for super admins. */
  superAdminOnly?: boolean;
}

export interface NavGroup {
  /** Section heading in the sidebar. */
  label: string;
  items: NavLinkItem[];
}

/**
 * The navigation tree, in one place.
 *
 * Both the sidebar and the topbar breadcrumb read from this, so a route's
 * label and icon are defined once rather than drifting between the two.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ href: '/' as Route, labelKey: 'dashboard', Icon: LayoutDashboard }],
  },
  {
    label: 'Content',
    items: [
      { href: '/content-types' as Route, labelKey: 'contentTypes', Icon: Database },
      { href: '/content' as Route, labelKey: 'content', Icon: FileText },
      { href: '/media' as Route, labelKey: 'media', Icon: ImageIcon },
    ],
  },
  {
    label: 'Access',
    items: [
      { href: '/users' as Route, labelKey: 'users', Icon: Users },
      { href: '/roles' as Route, labelKey: 'roles', Icon: Shield },
      { href: '/api-tokens' as Route, labelKey: 'apiTokens', Icon: Key },
      { href: '/agent-tokens' as Route, labelKey: 'agentTokens', Icon: Bot },
    ],
  },
  {
    label: 'Publishing',
    items: [
      { href: '/seo' as Route, labelKey: 'seo', Icon: Globe },
      { href: '/webhooks' as Route, labelKey: 'webhooks', Icon: Webhook },
      { href: '/forms' as Route, labelKey: 'forms', Icon: BookOpen },
      { href: '/menus' as Route, labelKey: 'menus', Icon: ListTree },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/plugins' as Route, labelKey: 'plugins', Icon: Puzzle },
      { href: '/trash' as Route, labelKey: 'trash', Icon: Trash2 },
      { href: '/audit-log' as Route, labelKey: 'auditLog', Icon: ScrollText },
      { href: '/settings/locales' as Route, labelKey: 'locales', Icon: Languages },
      { href: '/settings' as Route, labelKey: 'settings', Icon: Settings },
      {
        href: '/queues' as Route,
        labelKey: 'queueMonitor',
        Icon: MonitorDot,
        superAdminOnly: true,
      },
    ],
  },
];

/** Filters the tree down to what the current user may see. */
export function visibleNavGroups(isSuperAdmin: boolean): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.superAdminOnly !== true || isSuperAdmin),
  })).filter((group) => group.items.length > 0);
}

/**
 * Best match for a pathname — the longest `href` that prefixes it.
 * Longest-first matters: `/settings/locales` must win over `/settings`.
 */
export function findNavItem(pathname: string): NavLinkItem | undefined {
  const all = NAV_GROUPS.flatMap((group) => group.items);
  return [...all]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

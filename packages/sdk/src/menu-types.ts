// ── Menu link types ────────────────────────────────────────

export type MenuLinkType = 'content_entry' | 'external_url' | 'anchor' | 'custom';

// ── Menu item ──────────────────────────────────────────────

export interface MenuItemSummary {
  id: string;
  menuId: string;
  parentId: string | null;
  label: string;
  linkType?: MenuLinkType;
  url: string | null;
  entryId: string | null;
  target: string | null;
  position: number;
  isActive: boolean;
  children: MenuItemSummary[];
}

// ── Menu summary (list) ────────────────────────────────────

export interface MenuSummary {
  id: string;
  name: string;
  slug: string;
  localeCode: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

// ── Menu detail (with tree) ────────────────────────────────

export interface MenuDetail {
  id: string;
  name: string;
  slug: string;
  localeCode: string | null;
  items: MenuItemSummary[];
  createdAt: string;
  updatedAt: string;
}

// ── Request bodies ─────────────────────────────────────────

export interface CreateMenuBody {
  name: string;
  slug: string;
  localeCode?: string;
}

export interface UpdateMenuBody {
  name?: string;
  slug?: string;
  localeCode?: string;
}

export interface CreateMenuItemBody {
  label: string;
  linkType: MenuLinkType;
  url?: string;
  entryId?: string;
  target?: string;
  parentId?: string;
  position?: number;
  isActive?: boolean;
}

export interface UpdateMenuItemBody {
  label?: string;
  linkType?: MenuLinkType;
  url?: string;
  entryId?: string;
  target?: string;
  parentId?: string | null;
  position?: number;
  isActive?: boolean;
}

export interface ReorderItem {
  id: string;
  parentId?: string;
  order: number;
}

export interface ReorderMenuItemsBody {
  items: ReorderItem[];
}

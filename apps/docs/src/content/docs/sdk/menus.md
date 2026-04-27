---
title: Menus
description: Build and manage navigation menus with the SDK.
sidebar:
  order: 10
---

## List menus

```ts
const menus = await kast.menus.list();
// MenuSummary[] — id, name, slug, localeCode, itemCount
```

## Create menu

```ts
const menu = await kast.menus.create({
  name: 'Main Navigation',
  slug: 'main-nav',
  localeCode: 'en',
});
```

## Get menu by ID

```ts
const menu = await kast.menus.get(menuId);
// MenuDetail — includes full items tree
```

## Get menu by handle (slug)

```ts
const menu = await kast.menus.findByHandle('main-nav');
```

## Update menu

```ts
await kast.menus.update(menuId, { name: 'Primary Navigation' });
```

## Delete menu

```ts
await kast.menus.delete(menuId);
```

---

## Menu items

### Add item

```ts
const item = await kast.menus.addItem(menuId, {
  label: 'Blog',
  linkType: 'content_entry', // 'content_entry' | 'external_url' | 'anchor' | 'custom'
  entryId: blogIndexEntryId,
  position: 1,
  isActive: true,
});
```

### Update item

```ts
await kast.menus.updateItem(menuId, itemId, { label: 'Articles' });
```

### Delete item

```ts
await kast.menus.deleteItem(menuId, itemId);
```

### Reorder items

```ts
await kast.menus.reorder(menuId, {
  items: [
    { id: 'item-1', order: 0 },
    { id: 'item-2', order: 1, parentId: 'item-1' }, // nested under item-1
    { id: 'item-3', order: 2 },
  ],
});
```

---

## Render in Next.js

```tsx
// lib/nav.ts
import { kast } from '@/lib/kast';

export async function getMainNav() {
  return kast.menus.findByHandle('main-nav');
}

// components/Nav.tsx
import { getMainNav } from '@/lib/nav';

export default async function Nav() {
  const menu = await getMainNav();

  return (
    <nav>
      <ul>
        {menu.items.map((item) => (
          <li key={item.id}>
            <a href={item.url ?? '#'}>{item.label}</a>
            {item.children.length > 0 && (
              <ul>
                {item.children.map((child) => (
                  <li key={child.id}>
                    <a href={child.url ?? '#'}>{child.label}</a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

## Types

```ts
type MenuLinkType = 'content_entry' | 'external_url' | 'anchor' | 'custom';

interface MenuItemSummary {
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

interface MenuDetail {
  id: string;
  name: string;
  slug: string;
  localeCode: string | null;
  items: MenuItemSummary[];
  createdAt: string;
  updatedAt: string;
}
```

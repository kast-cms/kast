---
title: Menus
description: Build navigation menus and serve them to your frontend via the Delivery API.
---

Menus let you define structured navigation — header nav, footer links, sidebar — and serve them to your frontend dynamically.

## Creating a menu

1. Go to **Menus** → **New Menu**.
2. Enter a **name** (e.g. `Main Navigation`) and **slug** (e.g. `main-nav`).
3. Click **Save**.

## Adding menu items

In the menu editor, click **Add Item**:

| Field           | Description                                   |
| --------------- | --------------------------------------------- |
| Label           | Displayed link text                           |
| Type            | `url`, `entry`, or `menu` (sub-menu)          |
| URL             | For `url` type — the href                     |
| Entry           | For `entry` type — picker for a content entry |
| Open in new tab | Toggle                                        |
| Icon            | Optional icon name                            |

## Nested menus

Drag items to indent them under a parent item. This creates a tree structure with up to 3 levels of nesting.

## Fetching menus in your frontend

```bash
GET /api/v1/menus/main-nav
X-Kast-Key: your-delivery-api-key
```

Response:

```json
{
  "data": {
    "slug": "main-nav",
    "name": "Main Navigation",
    "items": [
      { "label": "Home", "url": "/", "children": [] },
      {
        "label": "Blog",
        "url": "/blog",
        "children": [
          { "label": "Technology", "url": "/blog/technology" },
          { "label": "Design", "url": "/blog/design" }
        ]
      },
      { "label": "About", "url": "/about", "children": [] }
    ]
  }
}
```

## SDK usage

```ts
// List all menus
const { data: menus } = await kast.menus.list();

// Get a menu by slug
const { data: menu } = await kast.menus.get('main-nav');

// Render in Next.js
export default async function Nav() {
  const { data: menu } = await kast.menus.get('main-nav');
  return (
    <nav>
      {menu.items.map((item) => (
        <a key={item.id} href={item.url}>{item.label}</a>
      ))}
    </nav>
  );
}
```

## Reordering items

Drag items in the admin panel UI. Changes are saved automatically on drop. Or via API:

```bash
PATCH /api/v1/menus/:menuId/items/reorder
{ "order": [{ "id": "item1", "parentId": null }, { "id": "item2", "parentId": "item1" }] }
```

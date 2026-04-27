---
title: Menus API
description: Build and serve navigation menus via the REST API.
---

## List menus

```http
GET /api/v1/menus
X-Kast-Key: <delivery-key>
```

## Get menu by slug

```http
GET /api/v1/menus/:slug
X-Kast-Key: <delivery-key>
```

Returns the full item tree.

## Create menu

```http
POST /api/v1/menus
Authorization: Bearer <token>   (EDITOR+)

{ "name": "Main Navigation", "slug": "main-nav" }
```

## Update menu

```http
PATCH /api/v1/menus/:id
Authorization: Bearer <token>

{ "name": "Primary Navigation" }
```

## Delete menu

```http
DELETE /api/v1/menus/:id
Authorization: Bearer <token>
```

## Add menu item

```http
POST /api/v1/menus/:menuId/items
Authorization: Bearer <token>

{
  "label": "Blog",
  "type": "url",
  "url": "/blog",
  "parentId": null,
  "order": 2,
  "openInNewTab": false
}
```

**Item types:** `url`, `entry` (links to a content entry), `menu` (sub-menu reference)

## Update menu item

```http
PATCH /api/v1/menus/:menuId/items/:itemId
Authorization: Bearer <token>

{ "label": "Articles" }
```

## Delete menu item

```http
DELETE /api/v1/menus/:menuId/items/:itemId
Authorization: Bearer <token>
```

Child items are also deleted.

## Reorder items

```http
PATCH /api/v1/menus/:menuId/items/reorder
Authorization: Bearer <token>

{
  "order": [
    { "id": "item1", "parentId": null },
    { "id": "item2", "parentId": "item1" },
    { "id": "item3", "parentId": null }
  ]
}
```

## Menu response shape

```json
{
  "data": {
    "id": "clxyz...",
    "slug": "main-nav",
    "name": "Main Navigation",
    "items": [
      {
        "id": "item1",
        "label": "Home",
        "type": "url",
        "url": "/",
        "order": 0,
        "openInNewTab": false,
        "children": []
      }
    ]
  }
}
```

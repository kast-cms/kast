---
title: Localization & RTL
description: Manage multi-language content with per-locale fields and right-to-left layout support.
---

Kast has first-class support for multiple languages and right-to-left scripts. Every part of the system — content, menus, forms, and the admin UI itself — is i18n-aware.

## Locales

A **locale** is a language/region code (e.g. `en`, `ar`, `fr-CA`). You manage locales in the admin panel under **Settings → Locales**, or via the API:

```bash
# List locales
GET /api/v1/locales

# Create a locale
POST /api/v1/locales
{ "code": "ar", "name": "Arabic", "direction": "rtl" }
```

The `direction` field is `ltr` (default) or `rtl`. Setting `rtl` enables the full RTL layout in the admin panel for that locale.

## Localized fields

When you mark a field as `localized: true`, each locale stores its own value. Non-localized fields share one value across all locales.

### Creating a localized entry

```bash
POST /api/v1/content-types/blog-post/entries
Authorization: Bearer <token>

{
  "locale": "en",
  "data": {
    "title": "Hello World",
    "slug": "hello-world"
  }
}
```

### Adding a translation

Update the same entry with a different locale:

```bash
PATCH /api/v1/content-types/blog-post/entries/:id
Authorization: Bearer <token>

{
  "locale": "ar",
  "data": {
    "title": "مرحباً بالعالم"
  }
}
```

### Fetching a specific locale

```bash
GET /api/v1/content-types/blog-post/entries/:id?locale=ar
```

If the requested locale has no translation for a localized field, Kast falls back to the **default locale** value.

## Default locale

Set the default locale in **Global Settings → General**. It serves as the fallback when a requested locale has no translation.

## RTL admin UI

When an editor switches to an RTL locale (e.g. Arabic), the admin panel mirrors its layout — sidebars, toolbars, and form layouts all flip to right-to-left. This is achieved using CSS logical properties (`margin-inline-start`, `padding-inline-end`, etc.) throughout the admin codebase.

## SDK — locale support

```ts
// Fetch Arabic entries
const { data: posts } = await kast.content.list('blog-post', {
  status: 'PUBLISHED',
  locale: 'ar',
});

// List available locales
const { data: locales } = await kast.locales.list();
```

## Delivery API — locale param

All delivery endpoints accept `?locale=<code>`:

```bash
GET /api/v1/content-types/blog-post/entries?locale=ar&status=PUBLISHED
```

Entries without a translation for the requested locale are excluded from the response by default.

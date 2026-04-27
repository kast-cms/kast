---
title: Locales API
description: Manage language locales for i18n content.
---

## List locales

```http
GET /api/v1/locales
```

Public — no auth required.

**Response:**

```json
{
  "data": [
    { "code": "en", "name": "English", "direction": "ltr", "isDefault": true },
    { "code": "ar", "name": "Arabic", "direction": "rtl", "isDefault": false }
  ]
}
```

## Get locale

```http
GET /api/v1/locales/:code
```

## Create locale

```http
POST /api/v1/locales
Authorization: Bearer <token>   (ADMIN+)

{
  "code": "fr",
  "name": "French",
  "direction": "ltr"
}
```

`code` must be a valid BCP 47 language tag (e.g. `en`, `ar`, `fr-CA`).

## Update locale

```http
PATCH /api/v1/locales/:code
Authorization: Bearer <token>

{ "name": "Français" }
```

## Delete locale

```http
DELETE /api/v1/locales/:code
Authorization: Bearer <token>
```

Cannot delete the default locale. Set another locale as default first via Global Settings.

## Set default locale

The default locale is set in **Global Settings → General → Default locale**. It serves as the fallback when a requested locale has no translation.

## Locale object

```json
{
  "code": "ar",
  "name": "Arabic",
  "direction": "rtl",
  "isDefault": false,
  "createdAt": "2026-01-01T00:00:00Z"
}
```

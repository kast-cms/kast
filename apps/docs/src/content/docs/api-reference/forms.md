---
title: Forms API
description: Create forms, accept public submissions, and retrieve collected data.
---

## List forms

```http
GET /api/v1/forms
X-Kast-Key: <delivery-key>
```

## Get form

```http
GET /api/v1/forms/:id
```

Returns the form schema without submissions.

## Create form

```http
POST /api/v1/forms
Authorization: Bearer <token>   (EDITOR+)

{
  "name": "Contact Us",
  "description": "General enquiries",
  "fields": [
    { "key": "name",    "label": "Your Name",    "type": "text",     "required": true },
    { "key": "email",   "label": "Email",         "type": "email",    "required": true },
    { "key": "message", "label": "Message",       "type": "textarea", "required": true }
  ],
  "notifyEmail": "hello@example.com"
}
```

**Field types:** `text`, `email`, `textarea`, `select`, `checkbox`, `number`

## Update form

```http
PATCH /api/v1/forms/:id
Authorization: Bearer <token>
```

## Delete form

```http
DELETE /api/v1/forms/:id
Authorization: Bearer <token>
```

## Submit a form (public)

```http
POST /api/v1/forms/:id/submit
Content-Type: application/json

{
  "name": "Oday Bakkour",
  "email": "oday@example.com",
  "message": "Hello!"
}
```

No authentication required. Rate limit: 10 requests / minute per IP.

Returns `201 Created` with the submission ID.

## List submissions

```http
GET /api/v1/forms/:id/submissions
Authorization: Bearer <token>   (EDITOR+)
?limit=50&cursor=<cursor>
```

## Export submissions as CSV

```http
GET /api/v1/forms/:id/submissions/export
Authorization: Bearer <token>
```

Returns `text/csv`.

## Submission object

```json
{
  "id": "sub_...",
  "formId": "clxyz...",
  "data": {
    "name": "Oday Bakkour",
    "email": "oday@example.com",
    "message": "Hello!"
  },
  "ipAddress": "1.2.3.x",
  "createdAt": "2026-04-27T10:00:00Z"
}
```

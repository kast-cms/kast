---
title: Forms API
description: Create forms, accept public submissions, and retrieve collected data.
---

## List forms

```http
GET /api/v1/forms
Authorization: Bearer <token>   (ADMIN+)
```

## Get form

```http
GET /api/v1/forms/:id
Authorization: Bearer <token>   (VIEWER+)
```

Returns the form schema without submissions.

## Create form

```http
POST /api/v1/forms
Authorization: Bearer <token>   (ADMIN+)

{
  "name": "Contact Us",
  "slug": "contact-us",
  "description": "General enquiries",
  "fields": [
    { "name": "name",    "label": "Your Name", "type": "TEXT",     "isRequired": true },
    { "name": "email",   "label": "Email",     "type": "EMAIL",    "isRequired": true },
    { "name": "message", "label": "Message",   "type": "TEXTAREA", "isRequired": true }
  ],
  "notifyEmail": "hello@example.com"
}
```

**Field types:** `TEXT`, `EMAIL`, `PHONE`, `NUMBER`, `TEXTAREA`, `SELECT`,
`MULTI_SELECT`, `CHECKBOX`, `RADIO`, `FILE`, `DATE`. Per-field validation and
choices live in the optional `config` object.

## Update form

```http
PATCH /api/v1/forms/:id
Authorization: Bearer <token>
Required role: `ADMIN+`.
```

## Delete form

```http
DELETE /api/v1/forms/:id
Authorization: Bearer <token>
Required role: `ADMIN+`.
```

## Submit a form (public)

```http
POST /api/v1/forms/:id/submit
Content-Type: application/json

{
  "data": {
    "name": "Oday Bakkour",
    "email": "oday@example.com",
    "message": "Hello!"
  },
  "_hp": ""
}
```

The answers go under `data`. `_hp` is an optional honeypot: a non-empty value
makes the request succeed while discarding the submission.

No authentication required. Rate limit: 10 requests / minute per IP.

Returns `200 OK` with a bare body — **not** a `{ data }` envelope:

```json
{ "ok": true }
```

### `ok` is not a receipt

An unknown, trashed or inactive form answers exactly the same way. That is
deliberate: it stops the endpoint being used to enumerate which form ids exist.

### Validation

Submissions are validated against the form's own field definitions before they
are stored. Unknown keys are rejected, required fields are enforced (a required
checkbox must actually be ticked), values are coerced per field type, and
`choices` / `min` / `max` / `minLength` / `maxLength` / `regex` are honoured. The
whole submission is capped at 64 KiB, and any string field without an explicit
`maxLength` at 10,000 characters. Only declared fields are persisted.

A failure is `400`:

```json
{
  "code": "FORM_SUBMISSION_INVALID",
  "errors": [
    { "field": "email", "rule": "format", "message": "Must be a valid email address" },
    { "field": "message", "rule": "required", "message": "This field is required" }
  ]
}
```

Messages name the failing rule only — they never echo the form's name, its
configured bounds or its allowed choices.

### Notification email

When the form has `notifyEmail` set, a `form-submission` job is queued to mail
the declared answers, HTML-escaped and truncated at 500 characters per value.
The submitter's IP address and user agent are never mailed; they stay behind
admin authentication. A queue failure is logged and swallowed — the submission
is already stored and the public request must not fail.

## Mark a submission read

```http
PATCH /api/v1/forms/:id/submissions/:subId/read
Authorization: Bearer <token>   (ADMIN+)

{ "isRead": true }
```

`isRead` defaults to `true`. `readAt` is set on read and cleared on unread. A
submission id belonging to a different form is a `404`.

## List submissions

```http
GET /api/v1/forms/:id/submissions
Authorization: Bearer <token>   (ADMIN+)
?limit=50&cursor=<cursor>
```

## Export submissions as CSV

```http
GET /api/v1/forms/:id/submissions/export
Authorization: Bearer <token>
Required role: `ADMIN+`.
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

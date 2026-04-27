---
title: Forms
description: Build contact forms and collect submissions without writing a backend.
---

Kast's forms module lets you define forms in the admin panel and accept submissions through the API — no backend code needed.

## Creating a form

1. Go to **Forms** → **New Form**.
2. Enter a **name** (e.g. `Contact Us`) and optional description.
3. Add fields using the field builder.
4. Click **Save**.

## Form fields

| Type       | Notes                                 |
| ---------- | ------------------------------------- |
| `text`     | Single-line text input                |
| `email`    | Email address (validated server-side) |
| `textarea` | Multi-line text                       |
| `select`   | Dropdown with configurable options    |
| `checkbox` | Boolean yes/no                        |
| `number`   | Numeric input                         |

Each field has a **label**, **key**, **required** flag, and optional **placeholder**.

## Submitting a form

The form submission endpoint is public — no authentication needed:

```bash
POST /api/v1/forms/:formId/submit
Content-Type: application/json

{
  "name": "Oday Bakkour",
  "email": "oday@example.com",
  "message": "Hello!"
}
```

Kast validates required fields and field types, then stores the submission. Rate limit: 10 submissions per minute per IP.

## Viewing submissions

Click a form in the list to see its submissions table:

- Submission timestamp
- All field values
- IP address (truncated)

Export submissions as CSV with the **Export** button.

## Email notifications

Configure an email notification for new submissions in the form settings:

- **Notify email** — address to receive notification emails
- **Reply-to** — set to the submitter's email field if desired

Notifications are queued via `kast.email` BullMQ.

## Anti-spam

For public deployments, add a honeypot field to your frontend form — a hidden input that bots fill in but humans don't:

```html
<input type="text" name="_hp" style="display:none" tabindex="-1" autocomplete="off" />
```

Kast rejects submissions where `_hp` is not empty.

## SDK usage

```ts
// List forms
const { data: forms } = await kast.forms.list();

// Submit a form (from frontend, no auth)
await kast.forms.submit(formId, {
  name: 'Oday Bakkour',
  email: 'oday@example.com',
  message: 'Hello!',
});

// List submissions (admin)
const { data: submissions } = await kast.forms.listSubmissions(formId, { limit: 50 });
```

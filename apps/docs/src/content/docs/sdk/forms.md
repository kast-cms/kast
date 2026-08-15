---
title: Forms
description: Create forms and collect submissions with the SDK.
sidebar:
  order: 9
---

## List forms

```ts
const forms = await kast.forms.list();
```

## Get form

```ts
const form = await kast.forms.get(formId);
```

## Create form

```ts
const form = await kast.forms.create({
  name: 'Contact Us',
  slug: 'contact-us',
  fields: [
    { name: 'name', label: 'Your Name', type: 'TEXT', isRequired: true },
    { name: 'email', label: 'Email', type: 'EMAIL', isRequired: true },
    { name: 'message', label: 'Message', type: 'TEXTAREA', isRequired: true },
  ],
  notifyEmail: 'hello@example.com',
});
```

## Update form

```ts
await kast.forms.update(formId, { name: 'Get in Touch' });
```

## Delete form

```ts
await kast.forms.delete(formId);
```

## Submit a form (no auth)

Use this from your frontend — no API key needed:

```ts
await kast.forms.submit(formId, {
  data: {
    name: 'Oday Bakkour',
    email: 'oday@example.com',
    message: 'Hello!',
  },
});
```

## List submissions

```ts
const {
  data: submissions,
  total,
  page,
  limit,
} = await kast.forms.listSubmissions(formId, {
  limit: 50,
});
```

## Export submissions as CSV

```ts
const csvBlob = await kast.forms.exportSubmissions(formId);
// csvBlob: Blob — save to file or create a download URL
```

## Contact form in Next.js

```ts
// app/contact/actions.ts
'use server';
import { kast } from '@/lib/kast';

export async function submitContact(formData: FormData) {
  await kast.forms.submit(process.env.CONTACT_FORM_ID!, {
    data: {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      message: formData.get('message') as string,
    },
  });
}
```

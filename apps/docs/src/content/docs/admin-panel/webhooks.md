---
title: Webhooks
description: Send real-time event notifications to external services when content changes.
---

Webhooks let you notify external services (Vercel revalidation, Slack, Zapier, etc.) whenever something happens in Kast.

## Creating a webhook

1. Go to **Settings → Webhooks** → **New Webhook**.
2. Enter the **URL** to receive the POST request.
3. Select the **events** to listen for.
4. Optionally add a **secret** for HMAC signature verification.
5. Click **Save**.

## Events

| Event                 | Fires when                    |
| --------------------- | ----------------------------- |
| `content.created`     | A new entry is created        |
| `content.updated`     | An entry's fields are updated |
| `content.published`   | An entry is published         |
| `content.unpublished` | An entry is unpublished       |
| `content.trashed`     | An entry is trashed           |
| `media.uploaded`      | A file is uploaded            |
| `media.deleted`       | A media file is deleted       |

## Payload format

```json
{
  "event": "content.published",
  "timestamp": "2026-04-27T10:00:00Z",
  "data": {
    "id": "clxyz...",
    "typeSlug": "blog-post",
    "status": "PUBLISHED"
  }
}
```

## HMAC verification

If you set a secret, Kast signs each request with `HMAC-SHA256`:

```
X-Kast-Signature: sha256=<hex-digest>
```

Verify in your endpoint:

```ts
import { createHmac } from 'crypto';

function verify(payload: string, secret: string, signature: string): boolean {
  const expected = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
  return expected === signature;
}
```

## Delivery and retries

Webhooks are delivered via the `kast.webhook` BullMQ queue. If the endpoint returns a non-2xx status, Kast retries with exponential backoff:

- Attempt 1: immediate
- Attempt 2: 30 seconds
- Attempt 3: 5 minutes
- Attempt 4: 30 minutes
- Attempt 5: 2 hours

After 5 failures, the job moves to the dead-letter queue (visible in Queue Monitor).

## Delivery log

Click a webhook in the list to see its delivery log:

- Timestamp, event, HTTP status, response time
- Request and response body (expandable)
- **Retry** button for failed deliveries

## Vercel revalidation example

```
URL: https://your-site.vercel.app/api/revalidate
Secret: <shared-secret>
Events: content.published, content.unpublished
```

Your Next.js route handler:

```ts
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache';

export async function POST(req: Request) {
  const body = await req.text();
  // verify HMAC here...
  const { event, data } = JSON.parse(body);
  if (event === 'content.published') {
    revalidatePath(`/blog/${data.slug}`);
  }
  return Response.json({ revalidated: true });
}
```

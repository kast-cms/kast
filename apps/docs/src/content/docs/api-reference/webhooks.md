---
title: Webhooks API
description: Configure outbound webhook endpoints and view delivery logs.
---

Requires `ADMIN+`.

## List webhooks

```http
GET /api/v1/webhooks
Authorization: Bearer <token>
```

## Get webhook

```http
GET /api/v1/webhooks/:id
Authorization: Bearer <token>
```

## Create webhook

```http
POST /api/v1/webhooks
Authorization: Bearer <token>

{
  "name": "Vercel revalidation",
  "url": "https://my-site.vercel.app/api/revalidate",
  "events": ["content.published", "content.unpublished"],
  "secret": "my-hmac-secret",
  "isActive": true
}
```

**Events:** `content.created`, `content.updated`, `content.published`, `content.unpublished`, `content.trashed`, `media.uploaded`, `media.deleted`

## Update webhook

```http
PATCH /api/v1/webhooks/:id
Authorization: Bearer <token>

{ "isActive": false }
```

## Delete webhook

```http
DELETE /api/v1/webhooks/:id
Authorization: Bearer <token>
```

## Delivery log

```http
GET /api/v1/webhooks/:id/deliveries
Authorization: Bearer <token>
?limit=20&status=failed
```

**Response:**

```json
{
  "data": [
    {
      "id": "del_...",
      "event": "content.published",
      "statusCode": 500,
      "responseTime": 1203,
      "attempt": 3,
      "createdAt": "2026-04-27T10:00:00Z",
      "error": "Internal Server Error"
    }
  ]
}
```

## Retry delivery

```http
POST /api/v1/webhooks/:id/deliveries/:deliveryId/retry
Authorization: Bearer <token>
```

Re-queues the delivery job immediately regardless of previous attempt count.

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

## HMAC signature

```
X-Kast-Signature: sha256=<hex>
X-Kast-Event: content.published
X-Kast-Delivery-Id: del_...
```

Verify with:

```ts
import { createHmac, timingSafeEqual } from 'crypto';

function verify(body: string, secret: string, header: string): boolean {
  const sig = Buffer.from(header.replace('sha256=', ''), 'hex');
  const expected = createHmac('sha256', secret).update(body).digest();
  return sig.length === expected.length && timingSafeEqual(sig, expected);
}
```

---
title: Webhooks
description: Manage webhooks and delivery logs with the SDK.
sidebar:
  order: 8
---

## List webhooks

```ts
const { data: hooks } = await kast.webhooks.list();
```

## Create webhook

```ts
const { data: hook } = await kast.webhooks.create({
  name: 'Vercel revalidation',
  url: 'https://my-site.vercel.app/api/revalidate',
  events: ['content.published', 'content.unpublished'],
  secret: 'my-hmac-secret',
  isActive: true,
});
```

## Update webhook

```ts
await kast.webhooks.update(hookId, { isActive: false });
```

## Delete webhook

```ts
await kast.webhooks.delete(hookId);
```

## Delivery log

```ts
const { data: deliveries } = await kast.webhooks.listDeliveries(hookId, {
  limit: 20,
  status: 'failed',
});
```

## Retry a delivery

```ts
await kast.webhooks.retryDelivery(hookId, deliveryId);
```

## Webhook type

```ts
interface WebhookSummary {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}
```

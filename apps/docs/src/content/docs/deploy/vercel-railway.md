---
title: Frontend on Vercel + API on Railway
description: Deploy your Next.js frontend to Vercel while running Kast on Railway.
sidebar:
  order: 4
---

A common pattern for Kast-powered sites: deploy the Kast API and admin panel to Railway, and your Next.js frontend to Vercel. This gives you:

- Railway's persistent infrastructure for the CMS backend
- Vercel's global edge network and instant preview deployments for the frontend

## Architecture

```
Vercel                    Railway
──────────────────        ──────────────────────────────
Next.js frontend    ─────▶  Kast API  ──▶  Postgres
(SSG / ISR / SSR)           Kast Admin       Redis
```

## Step 1 — Deploy Kast to Railway

Follow the [Railway deploy guide](./railway). Note your API URL (e.g. `https://kast-api.up.railway.app`).

## Step 2 — Set up the SDK in your Next.js project

```bash
npm install @kast/sdk
```

```ts
// lib/kast.ts
import { KastClient } from '@kast/sdk';

export const kast = new KastClient({
  baseUrl: process.env.KAST_API_URL!,
  apiKey: process.env.KAST_DELIVERY_KEY!,
});
```

## Step 3 — Configure Vercel environment variables

In the Vercel dashboard, add:

| Variable            | Value                                              |
| ------------------- | -------------------------------------------------- |
| `KAST_API_URL`      | `https://kast-api.up.railway.app`                  |
| `KAST_DELIVERY_KEY` | A delivery API key from Kast Settings → API Tokens |

## Step 4 — On-demand ISR with webhooks

Configure a Kast webhook to trigger Vercel's on-demand revalidation when content is published:

```ts
// In Kast admin: Settings → Webhooks → New webhook
// URL: https://my-site.vercel.app/api/revalidate
// Events: content.published, content.unpublished
// Secret: <random string>
```

```ts
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const sig = req.headers.get('x-kast-signature') ?? '';
  const body = await req.text();

  const expected = crypto
    .createHmac('sha256', process.env.KAST_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');

  if (sig !== `sha256=${expected}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  revalidatePath('/', 'layout');
  return new Response('Revalidated');
}
```

## Step 5 — Deploy to Vercel

```bash
vercel deploy --prod
```

Or connect your GitHub repo to Vercel for automatic deployments on push.

## CORS configuration

Add your Vercel domain to `CORS_ORIGINS` in Railway:

```
CORS_ORIGINS=https://my-site.vercel.app,https://my-custom-domain.com
```

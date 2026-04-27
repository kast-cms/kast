---
title: Deploy to Railway
description: One-click deploy Kast CMS to Railway.
sidebar:
  order: 1
---

Railway auto-provisions Postgres, Redis, and the API + Admin services from the included `railway.toml`.

## One-click deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/kast)

This provisions:

- `kast-api` — NestJS API
- `kast-admin` — Next.js admin panel
- `postgres` — PostgreSQL 16
- `redis` — Redis 7

## Post-deploy configuration

After the deploy completes, set these env vars in the Railway dashboard under each service:

### kast-api (required)

| Var            | Value                                                |
| -------------- | ---------------------------------------------------- |
| `JWT_SECRET`   | Random string ≥ 32 chars — Railway can generate this |
| `CORS_ORIGINS` | Your frontend domain, e.g. `https://my-site.com`     |

`DATABASE_URL` and `REDIS_URL` are automatically linked from the provisioned databases.

### kast-admin (required)

| Var                   | Value                                                               |
| --------------------- | ------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | Your `kast-api` Railway URL, e.g. `https://kast-api.up.railway.app` |

## Running migrations

Migrations run automatically on API startup via `prisma migrate deploy`. Check the deploy logs to confirm they ran successfully.

## Custom domain

1. In Railway, open the `kast-api` service.
2. Go to **Settings → Networking → Custom Domain**.
3. Add your domain and follow the DNS instructions.
4. Update `CORS_ORIGINS` to include the new domain.

## Scaling

Railway's usage-based billing means you only pay for what you use on the free plan. For production, upgrade to a paid plan for:

- Persistent volumes for local file storage
- More RAM and CPU for the API
- Private networking between services

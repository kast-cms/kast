---
title: Deploy to Render
description: Deploy Kast CMS to Render using the included render.yaml blueprint.
sidebar:
  order: 2
---

The included `render.yaml` deploys Kast as a Render Blueprint — API, Admin, Postgres, and Redis in one click.

## One-click deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/kast-cms/kast)

This provisions:

- `kast-api` — Docker web service
- `kast-admin` — Docker web service
- `kast-postgres` — Managed PostgreSQL
- `kast-redis` — Managed Redis

## Post-deploy configuration

After deployment, set these additional env vars in the Render dashboard:

### kast-api

| Var            | Required | Notes                                 |
| -------------- | -------- | ------------------------------------- |
| `JWT_SECRET`   | yes      | ≥ 32 chars. Render can auto-generate. |
| `CORS_ORIGINS` | yes      | Frontend domain(s), comma-separated   |

`DATABASE_URL` and `REDIS_URL` are automatically wired from the managed databases.

### kast-admin

| Var                   | Required | Notes                                                  |
| --------------------- | -------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_API_URL` | yes      | `https://kast-api.onrender.com` (your API service URL) |

## File storage

The default `render.yaml` uses `STORAGE_PROVIDER=local` with `/tmp/kast-uploads` — this is ephemeral and will be cleared on redeploy. For production:

1. Add a [Render Disk](https://docs.render.com/disks) to `kast-api`.
2. Mount it at `/data/uploads`.
3. Set `STORAGE_LOCAL_DIR=/data/uploads` and `STORAGE_LOCAL_URL=https://kast-api.onrender.com/uploads`.

Or switch to S3/R2 storage by setting `STORAGE_PROVIDER=s3` or `STORAGE_PROVIDER=r2` with the appropriate credentials.

## Health check

Render monitors `GET /api/v1/health`. The API responds with `{ "status": "ok" }` when ready. Allow 2–3 minutes for the first deploy while Prisma migrations run.

## Custom domain

1. Open your `kast-api` service on Render.
2. Go to **Settings → Custom Domains**.
3. Add your domain and update your DNS.
4. Add the domain to `CORS_ORIGINS` in the `kast-api` env vars.

---
title: Docker Compose
description: Run Kast CMS locally or on a VPS with Docker Compose.
sidebar:
  order: 3
---

The included `docker-compose.yml` starts Postgres, Redis, and the Kast API. Use it for local development, CI, or self-hosting on a VPS.

## Quick start

```bash
git clone https://github.com/kast-cms/kast.git
cd kast
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — set JWT_SECRET at minimum
docker compose up
```

The API is now running at `http://localhost:3000`.

## What's in docker-compose.yml

```yaml
services:
  postgres: # PostgreSQL 16 on port 5432
  redis: # Redis 7 on port 6379
  api: # Kast API on port 3000 (built from apps/api/Dockerfile)
```

The `api` service depends on both `postgres` and `redis` health checks.

## Required env vars

Create `apps/api/.env` before starting:

```bash
# Minimum required
DATABASE_URL=postgresql://kast:kast_secret@postgres:5432/kast_db
REDIS_URL=redis://redis:6379
JWT_SECRET=change-me-to-a-long-random-string-of-at-least-32-characters

# Recommended for production
CORS_ORIGINS=https://your-frontend.com
NODE_ENV=production
```

The `docker-compose.yml` loads `.env` from `apps/api/.env` via `env_file`.

## Persistent storage

Volumes are named and persist across restarts:

| Volume          | Contents                                              |
| --------------- | ----------------------------------------------------- |
| `postgres_data` | All database data                                     |
| `redis_data`    | Redis AOF/RDB snapshots                               |
| `uploads`       | Uploaded media files (mounted at `/tmp/kast-uploads`) |

## Running the admin panel

The `docker-compose.yml` includes only the API. To run the admin panel locally:

```bash
pnpm dev --filter admin
```

Or add it as a service:

```yaml
admin:
  build:
    context: .
    dockerfile: apps/admin/Dockerfile
  ports:
    - '3001:3001'
  environment:
    NEXT_PUBLIC_API_URL: http://localhost:3000
```

## VPS deployment

1. Copy the repo to your server.
2. Create `apps/api/.env` with production values.
3. Run `docker compose up -d`.
4. Put Nginx or Caddy in front for TLS termination.

Example Caddyfile:

```
api.example.com {
  reverse_proxy localhost:3000
}
```

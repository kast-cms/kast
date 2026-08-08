---
title: Docker Compose
description: Run Kast CMS locally or on a VPS with Docker Compose.
sidebar:
  order: 3
---

The included `docker-compose.yml` starts Postgres, Redis, the Kast API, and the
Kast admin panel. Use it for local development, CI, or self-hosting on a VPS.

## Quick start

```bash
git clone https://github.com/kast-cms/kast.git
cd kast
cp .env.example .env
# Edit .env — set JWT_SECRET at minimum
docker compose up --build
```

The API is now running at `http://localhost:3000` and the admin panel at
`http://localhost:3001/admin`.

## What's in docker-compose.yml

```yaml
services:
  postgres: # PostgreSQL 16 on port 5432
  redis: # Redis 7 on port 6379
  api: # Kast API on port 3000 (built from apps/api/Dockerfile)
  admin: # Kast Admin on port 3001 (built from apps/admin/Dockerfile)
```

The `api` service depends on both `postgres` and `redis` health checks and runs
pending Prisma migrations before starting.

## Required env vars

Create `.env` before starting:

```bash
# Minimum required
JWT_SECRET=change-me-to-a-long-random-string-of-at-least-32-characters

# Recommended for production
CORS_ORIGINS=https://your-frontend.com
NODE_ENV=production
```

The `docker-compose.yml` loads `.env` via `env_file`. For the bundled Postgres
and Redis services, the API container overrides `DATABASE_URL` and `REDIS_HOST`
to use Docker service names, so the same `.env` can also work for host-based
local development.

## Persistent storage

Volumes are named and persist across restarts:

| Volume          | Contents                                              |
| --------------- | ----------------------------------------------------- |
| `postgres_data` | All database data                                     |
| `redis_data`    | Redis AOF/RDB snapshots                               |
| `uploads`       | Uploaded media files (mounted at `/tmp/kast-uploads`) |

## Running the admin panel

The admin panel is included as the `admin` service and is available at
`http://localhost:3001/admin`.

## VPS deployment

1. Copy the repo to your server.
2. Create `.env` with production values.
3. Run `docker compose up -d`.
4. Put Nginx or Caddy in front for TLS termination.

Example Caddyfile:

```
api.example.com {
  reverse_proxy localhost:3000
}
```

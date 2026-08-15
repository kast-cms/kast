---
title: Docker Compose
description: Run Kast CMS locally or on a VPS with Docker Compose.
sidebar:
  order: 3
---

The included `docker-compose.yml` starts Postgres, Redis, the Kast API, and the admin panel. Use it for local development, CI, or self-hosting on a VPS.

## Quick start

```bash
git clone https://github.com/kast-cms/kast.git
cd kast
cp .env.example .env
# Set POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET, and
# KAST_SECRET_ENCRYPTION_KEY before starting.
docker compose up
```

The API is at `http://localhost:3000`; the admin is at `http://localhost:3001/admin`.

## What's in docker-compose.yml

```yaml
services:
  postgres: # PostgreSQL 16 on port 5432
  redis: # Redis 7, private to the Compose network
  api: # Kast API on port 3000 (built from apps/api/Dockerfile)
  admin: # Kast admin on port 3001 (built from apps/admin/Dockerfile)
```

The `api` service depends on both `postgres` and `redis` health checks.

## Required env vars

Create the root `.env` before starting:

```bash
# Minimum required
POSTGRES_PASSWORD=<random-value>
REDIS_PASSWORD=<different-random-value>
JWT_SECRET=change-me-to-a-long-random-string-of-at-least-32-characters
KAST_SECRET_ENCRYPTION_KEY=another-random-string-of-at-least-32-characters

# Recommended for production
CORS_ORIGINS=https://your-frontend.com
NODE_ENV=production
```

Compose builds the internal database and Redis URLs from these values. PostgreSQL
is bound to loopback only; Redis is not published to the host.

## Persistent storage

Volumes are named and persist across restarts:

| Volume          | Contents                                              |
| --------------- | ----------------------------------------------------- |
| `postgres_data` | All database data                                     |
| `redis_data`    | Redis append-only file and RDB snapshots              |
| `uploads`       | Uploaded media files (mounted at `/tmp/kast-uploads`) |

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

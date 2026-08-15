---
title: Health API
description: Check the operational status of the Kast API and its dependencies.
---

## Health check

```http
GET /api/v1/health
```

No authentication required. This liveness endpoint checks PostgreSQL and Redis.

**Response:**

```json
{
  "status": "ok",
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  },
  "error": {},
  "details": {}
}
```

For traffic readiness, use `GET /api/v1/health/ready`. It also performs a
write/read/delete storage probe, checks every background worker, and enforces the
configured queue backlog and failed-job thresholds. A failed check returns 503.

## Use cases

**Docker / container health check:**

```yaml
# docker-compose.yml
healthcheck:
  test: ['CMD', 'curl', '-f', 'http://localhost:3000/api/v1/health']
  interval: 30s
  timeout: 10s
  retries: 3
```

**CI smoke test:**

```bash
# Wait for API to be ready
until curl -sf http://localhost:3000/api/v1/health; do
  echo "Waiting for API..."
  sleep 2
done
echo "API is ready"
```

**Uptime monitoring:**

Point uptime monitoring at `/health` and orchestration/readiness alerts at
`/health/ready`. The latter intentionally becomes unavailable for storage,
worker, backlog, or dead-letter incidents.

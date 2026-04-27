---
title: Health API
description: Check the operational status of the Kast API and its dependencies.
---

## Health check

```http
GET /api/v1/health
```

No authentication required. Returns `200 OK` when the service is healthy.

**Response:**

```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```

If any dependency is unavailable, the status is `"degraded"` and the HTTP response code is `503`.

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

Point your uptime monitor (UptimeRobot, Betterstack, etc.) at `GET /api/v1/health`. Alerts fire if the endpoint returns non-200 or times out.

## Version information

The `version` field reflects the `package.json` version of `apps/api`. This matches the GitHub release tag and Docker image tag.

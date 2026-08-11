---
title: Environment Variables
description: Complete reference for all Kast API environment variables.
sidebar:
  order: 5
---

## Core (required)

| Variable       | Default | Notes                                               |
| -------------- | ------- | --------------------------------------------------- |
| `DATABASE_URL` | —       | PostgreSQL connection string                        |
| `JWT_SECRET`   | —       | ≥ 32 chars. Used to sign access and refresh tokens. |

## Server

| Variable       | Default       | Notes                                                     |
| -------------- | ------------- | --------------------------------------------------------- |
| `NODE_ENV`     | `development` | Set to `production` for production deploys                |
| `PORT`         | `3000`        | HTTP port the API listens on                              |
| `CORS_ORIGINS` | `*`           | Comma-separated allowed origins. Lock down in production. |

## Security

| Variable                     | Default                    | Notes                                                                                   |
| ---------------------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| `KAST_SECRET_ENCRYPTION_KEY` | falls back to `JWT_SECRET` | ≥ 32 chars. Encrypts secret settings (e.g. `smtp.password`) at rest.                    |
| `WEBHOOK_ALLOWED_HOSTS`      | _(empty)_                  | Hosts webhooks may target despite resolving to a private address. Empty = default-deny. |

:::caution
If `KAST_SECRET_ENCRYPTION_KEY` is unset, secrets are encrypted with
`JWT_SECRET` — rotating `JWT_SECRET` then makes every stored secret setting
unreadable. Set it explicitly in production.
:::

### Webhook egress policy

Webhook targets are validated at create/update time **and** again before every
delivery, including after each redirect hop. Rejected by default:

- any scheme other than `http`/`https`
- loopback, private, link-local, unique-local, multicast and other reserved
  addresses (IPv4 and IPv6, including IPv4-mapped forms)
- hostnames that resolve to any of the above

List hosts in `WEBHOOK_ALLOWED_HOSTS` (comma or space separated, `*.suffix`
wildcards supported) to allow them anyway.

## Plugins

| Variable         | Default                            | Notes                                                                                              |
| ---------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| `KAST_API_URL`   | `http://127.0.0.1:${PORT ?? 3000}` | API origin plugins call back on. **Not** the admin panel.                                          |
| `KAST_API_TOKEN` | —                                  | Required by the Meilisearch and Stripe plugins to read entries. A `READ_ONLY` token is sufficient. |

## Redis

| Variable         | Default     | Notes                                                                 |
| ---------------- | ----------- | --------------------------------------------------------------------- |
| `REDIS_URL`      | —           | Full connection URL, e.g. `redis://localhost:6379`. Takes precedence. |
| `REDIS_HOST`     | `localhost` | Used if `REDIS_URL` is not set                                        |
| `REDIS_PORT`     | `6379`      | Used if `REDIS_URL` is not set                                        |
| `REDIS_PASSWORD` | —           | Used if `REDIS_URL` is not set                                        |

## JWT

| Variable         | Default | Notes                                              |
| ---------------- | ------- | -------------------------------------------------- |
| `JWT_EXPIRES_IN` | `15m`   | Access token TTL. Refresh tokens expire in 7 days. |

## Storage

| Variable            | Default                         | Notes                             |
| ------------------- | ------------------------------- | --------------------------------- |
| `STORAGE_PROVIDER`  | `local`                         | One of `local`, `s3`, `r2`, `gcs` |
| `STORAGE_LOCAL_DIR` | `./uploads`                     | Directory for local storage       |
| `STORAGE_LOCAL_URL` | `http://localhost:3000/uploads` | Public URL prefix for local files |

### S3 / R2

Required when `STORAGE_PROVIDER=s3` or `STORAGE_PROVIDER=r2`:

| Variable                | Notes                                                   |
| ----------------------- | ------------------------------------------------------- |
| `AWS_REGION`            | e.g. `us-east-1`                                        |
| `AWS_ACCESS_KEY_ID`     |                                                         |
| `AWS_SECRET_ACCESS_KEY` |                                                         |
| `AWS_S3_BUCKET`         | Bucket name                                             |
| `AWS_S3_ENDPOINT`       | For R2: `https://<account-id>.r2.cloudflarestorage.com` |

## Upload limits

| Variable                    | Default                    | Notes                              |
| --------------------------- | -------------------------- | ---------------------------------- |
| `UPLOAD_MAX_FILE_SIZE_MB`   | `50`                       | Max file size in megabytes         |
| `UPLOAD_ALLOWED_MIME_TYPES` | `image/jpeg,image/png,...` | Comma-separated allowed MIME types |

## OAuth (optional)

| Variable               | Notes                                                      |
| ---------------------- | ---------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | Google OAuth app client ID                                 |
| `GOOGLE_CLIENT_SECRET` | Google OAuth app client secret                             |
| `GITHUB_CLIENT_ID`     | GitHub OAuth app client ID                                 |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret                             |
| `SITE_URL`             | Base URL of your deployment — used for OAuth redirect URIs |

## SMTP email (optional)

| Variable      | Default           | Notes                 |
| ------------- | ----------------- | --------------------- |
| `SMTP_HOST`   | `localhost`       |                       |
| `SMTP_PORT`   | `1025`            |                       |
| `SMTP_SECURE` | —                 | Set to `true` for TLS |
| `SMTP_USER`   | —                 |                       |
| `SMTP_PASS`   | —                 |                       |
| `SMTP_FROM`   | `noreply@kast.io` | Sender address        |

## Plugin env vars

See [First-party plugins](../plugins/first-party-plugins) for plugin-specific env vars (Meilisearch, R2, Resend, Sentry, Stripe).

## Admin panel

The Next.js admin panel uses one env var:

| Variable              | Notes                                                    |
| --------------------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | Full URL to the Kast API, e.g. `https://api.example.com` |

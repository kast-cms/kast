# @kast-cms/kast-plugin-sentry

Capture and report production errors to [Sentry](https://sentry.io).

## Setup

Install the Sentry Node.js SDK in your API:

```bash
pnpm add @sentry/node --filter @kast-cms/api
```

Then add to your `.env`:

```env
SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz
SENTRY_ENVIRONMENT=production           # optional (default: production)
SENTRY_TRACES_SAMPLE_RATE=0.1          # optional (default: 0.1)
```

## How it works

When `SENTRY_DSN` is set, the Kast API initializes the Sentry SDK at startup and forwards all 5xx errors from the `GlobalExceptionFilter` to Sentry, including the request path and HTTP method as context.

`@sentry/node` is an **optional peer dependency** — if it's not installed and `SENTRY_DSN` is not set, the API starts normally without any error.

## Admin panel

Accessible at `/plugins/sentry` in the Kast admin — shows current configuration and recent error count.

---
title: Security Checklist
description: Pre-production security checklist for Kast CMS deployments.
sidebar:
  order: 3
---

Run through this checklist before making a Kast deployment accessible to users.

## Authentication & tokens

- [ ] `JWT_SECRET` is at least 32 random characters and not the default
- [ ] `JWT_SECRET` is stored in a secrets manager, not in source code
- [ ] Management API keys are not embedded in frontend code
- [ ] Delivery API keys (read-only) are used for all public frontend calls
- [ ] Agent tokens use the minimum required scopes

## Network & transport

- [ ] TLS is enforced — HTTPS only in production
- [ ] `CORS_ORIGINS` is set to specific domains — not `*` in production
- [ ] The API is not directly reachable from the internet without a reverse proxy (Nginx, Caddy, etc.)
- [ ] Database and Redis are not publicly accessible — only reachable from the API service

## Storage

- [ ] `STORAGE_PROVIDER` is not `local` in production (or a persistent volume is mounted)
- [ ] S3/R2 bucket is not publicly writable
- [ ] `UPLOAD_MAX_FILE_SIZE_MB` is set appropriately
- [ ] `UPLOAD_ALLOWED_MIME_TYPES` does not include executable types (`.js`, `.exe`, etc.)

## Access control

- [ ] There is at most one `SUPER_ADMIN` account
- [ ] Service accounts (bots, automations) use API keys or agent tokens — not user accounts
- [ ] Inactive users are deactivated, not left with active credentials
- [ ] OAuth is configured only for trusted providers (Google, GitHub)

## Operations

- [ ] Audit log is reviewed periodically
- [ ] Webhook secrets are set — not empty strings
- [ ] `NODE_ENV=production` is set (disables debug middleware, source maps, etc.)
- [ ] Error monitoring is configured (Sentry plugin or equivalent)
- [ ] Backup strategy is in place for the database

## Dependencies

- [ ] `pnpm audit` passes with no high or critical vulnerabilities
- [ ] Dependabot or equivalent is enabled for automated dependency updates

## Plugins

- [ ] Only trusted plugins are installed
- [ ] Plugin env vars containing secrets are stored in the secrets manager
- [ ] Disabled plugins are removed, not just toggled off

---
title: Installation
description: Install Kast CMS using the create-kast-app CLI or manually via Docker Compose.
sidebar:
  order: 1
---

## Prerequisites

| Requirement | Version            |
| ----------- | ------------------ |
| Node.js     | ≥ 20               |
| pnpm        | ≥ 9                |
| Docker      | any recent version |

## Option A — CLI (recommended)

```bash
npx create-kast-app my-site
```

The CLI walks you through an interactive setup:

- Project name and API port
- Language / locale selection (i18n)
- Storage provider (local filesystem, Cloudflare R2, S3, MinIO)
- First-party plugins to install
- Optional Next.js frontend starter (blog or docs template)

It then generates a complete project, installs dependencies, and prints next steps.

```
✓ Done! Project created in ./my-site

  cd my-site
  cp .env.example .env
  docker-compose up

  Admin:  http://localhost:3001/admin
  API:    http://localhost:3001/api/v1
  MCP:    http://localhost:3001/mcp
```

### Skip interactive mode

```bash
npx create-kast-app my-site --skip-interactive
```

Generates with all defaults: English only, local storage, no plugins, no frontend starter.

### Node.js version check

If you run the CLI with Node.js < 20, it exits immediately:

```
✖ Kast requires Node.js >= 20. You have 18.x.
  Upgrade: https://nodejs.org/en/download/
```

---

## Option B — Manual Docker Compose

Clone the repository and start services directly:

```bash
git clone https://github.com/kast-cms/kast.git
cd kast
cp .env.example .env
docker-compose up
```

The compose file starts:

- **PostgreSQL 16** on port 5432
- **Redis 7** on port 6379
- **Kast API** (NestJS) on port 3000
- **Kast Admin** (Next.js) on port 3001

---

## Verify the install

```bash
curl http://localhost:3000/api/v1/health
# {"status":"ok","version":"1.0.0"}
```

Open the admin panel at `http://localhost:3001/admin` and complete the first-run setup wizard to create your super-admin account.

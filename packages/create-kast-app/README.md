<div align="center">

# create-kast-app

**Scaffold a new [Kast CMS](https://github.com/kast-cms/kast) project in seconds**

[![npm version](https://img.shields.io/npm/v/create-kast-app?color=blueviolet&style=flat-square)](https://www.npmjs.com/package/create-kast-app)
[![npm downloads](https://img.shields.io/npm/dm/create-kast-app?style=flat-square)](https://www.npmjs.com/package/create-kast-app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://github.com/kast-cms/kast/blob/main/LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?style=flat-square&logo=node.js)](https://nodejs.org/)

> Interactive CLI to generate a production-ready Kast CMS project — with Docker Compose, optional plugins, frontend starters, and deploy configs included.

</div>

---

## Quick Start

```bash
npx create-kast-app@latest
```

Or pass a project name directly:

```bash
npx create-kast-app@latest my-project
```

---

## What it does

The CLI walks you through a short set of interactive prompts and generates a complete `docker-compose.yml`-based project with:

| Prompt               | Options                                                          |
| -------------------- | ---------------------------------------------------------------- |
| **Project name**     | Any lowercase slug                                               |
| **API port**         | Default `3000` — auto-suggests a free port if taken              |
| **i18n**             | Enable multi-language support (ar, fr, de, es, pt, zh, ja)       |
| **Storage provider** | Local filesystem · Cloudflare R2 · Amazon S3 · MinIO             |
| **Plugins**          | Meilisearch · Stripe · Resend · R2 · Sentry                      |
| **Frontend starter** | None · Blog template · Docs template (Next.js + `@kast-cms/sdk`) |
| **Deploy config**    | None · Railway · Render · Vercel                                 |

---

## Non-interactive mode

Skip all prompts and scaffold with sensible defaults:

```bash
npx create-kast-app my-project --skip-interactive
```

---

## After scaffolding

```bash
cd my-project
nano .env               # Set JWT_SECRET and review settings
docker-compose up       # Start the full stack
```

| Service      | URL                          |
| ------------ | ---------------------------- |
| Admin UI     | http://localhost:3001/admin  |
| REST API     | http://localhost:3000/api/v1 |
| MCP endpoint | http://localhost:3000/mcp    |

---

## Requirements

- **Node.js** ≥ 20
- **Docker** + **Docker Compose** (for running the generated project)

---

## Documentation

Full docs at **[docs.kast.dev](https://docs.kast.dev)**

---

## License

MIT © [Kast CMS](https://github.com/kast-cms/kast)

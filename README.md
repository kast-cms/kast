# Kast CMS

> Cast Your Content Everywhere

**Open-source. AI-native. Developer-first. Easy for everyone.**

Kast is a modern headless CMS built on NestJS + Next.js with a built-in MCP server, first-class SEO tooling, and RTL/i18n support from day one.

---

## Quick Start

```bash
npx create-kast-app my-site
cd my-site
cp .env.example .env
docker-compose up
```

**Admin:** http://localhost:3001/admin  
**API:** http://localhost:3001/api/v1  
**MCP:** http://localhost:3001/mcp

---

## What Makes Kast Different

| Feature | Kast | Strapi | Payload | WordPress |
|---|---|---|---|---|
| SEO built-in (not a plugin) | ✅ | ❌ | ❌ | ❌ |
| MCP server (AI agent control) | ✅ | ❌ | ❌ | ❌ |
| RTL / Arabic first-class | ✅ | ⚠️ | ⚠️ | ⚠️ |
| TypeScript end-to-end | ✅ | ⚠️ | ✅ | ❌ |
| Setup in under 5 minutes | ✅ | ⚠️ | ⚠️ | ✅ |

---

## Stack

- **Backend:** NestJS + TypeScript + Prisma + PostgreSQL
- **Admin:** Next.js 15 (App Router)
- **Queue:** BullMQ + Redis
- **Auth:** JWT + refresh token rotation + OAuth
- **Storage:** Local FS + S3-compatible (pluggable)

---

## Monorepo Structure

```
kast/
├── apps/
│   ├── api/          # NestJS backend
│   ├── admin/        # Next.js admin panel
│   ├── web-starter/  # Next.js frontend starter
│   └── cli/          # create-kast-app CLI
├── packages/
│   ├── core/         # @kast/core — shared types
│   ├── sdk/          # @kast/sdk — TypeScript client
│   ├── plugin-sdk/   # @kast/plugin-sdk — plugin interface
│   └── ui/           # @kast/ui — shared components
└── plugins/          # First-party plugins
    ├── stripe/
    ├── meilisearch/
    ├── resend/
    ├── cloudflare-r2/
    └── sentry/
```

---

## Development

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker

### Setup

```bash
# Clone
git clone https://github.com/kast-cms/kast.git
cd kast

# Install dependencies
pnpm install

# Copy env
cp apps/api/.env.example apps/api/.env

# Start services (PostgreSQL + Redis)
docker-compose up -d postgres redis

# Start dev servers
pnpm dev
```

---

## Documentation

Full documentation at [kastcms.com/docs](https://kastcms.com/docs)

- [Getting Started](https://kastcms.com/docs/getting-started)
- [API Reference](https://kastcms.com/docs/api)
- [Plugin SDK](https://kastcms.com/docs/plugins)
- [MCP Server](https://kastcms.com/docs/mcp)

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

- [Report a Bug](https://github.com/kast-cms/kast/issues/new?template=bug_report.md)
- [Request a Feature](https://github.com/kast-cms/kast/issues/new?template=feature_request.md)
- [Discord](https://discord.gg/kast-cms)

---

## License

[MIT](./LICENSE) — Copyright (c) 2026 Oday Bakkour

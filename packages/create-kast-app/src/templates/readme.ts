export const README_TEMPLATE = `# {{projectName}}

> Powered by [Kast CMS](https://kast.dev) — Cast Your Content Everywhere.

## Quick Start

\`\`\`bash
# 1. Review environment
# .env is created from .env.example during scaffolding.
# Edit .env — set JWT_SECRET and review settings.

# 2. Start the full stack with Docker
docker compose up

# Or run locally against your own Postgres/Redis:
{{packageManager}} run db:migrate && {{packageManager}} run dev
\`\`\`

The admin panel opens at **http://localhost:3001/admin**.

## Services

| Service       | URL                                        |
| ------------- | ------------------------------------------ |
| Admin Panel   | http://localhost:3001/admin                |
| REST API      | http://localhost:{{apiPort}}/api/v1        |
| MCP Server    | http://localhost:{{apiPort}}/mcp           |
| API Docs      | http://localhost:{{apiPort}}/api/docs      |
| Health Check  | http://localhost:{{apiPort}}/api/v1/health |
{{#if includeFrontend}}| Frontend      | http://localhost:3002                      |
{{/if}}{{#if includeMeilisearch}}| Meilisearch   | http://localhost:7700                      |
{{/if}}
## Project Structure

\`\`\`
{{projectName}}/
├── apps/
│   ├── api/               # NestJS REST API + MCP server
│   └── admin/             # Next.js admin panel
{{#if includeFrontend}}│   └── web/               # Next.js {{frontendStarter}} frontend
{{/if}}├── packages/
│   ├── sdk/               # @kast-cms/sdk — typed API client
│   └── plugin-sdk/        # SDK for building Kast plugins
├── plugins/               # Installed Kast plugins
├── docker-compose.yml     # Production Docker deployment (optional)
├── .env.example
└── .env                   # (gitignored)
\`\`\`

## Useful Commands

| Command | Description |
| --- | --- |
| \`{{packageManager}} run dev\` | Start all apps in watch mode |
| \`{{packageManager}} run build\` | Build all apps |
| \`{{packageManager}} run db:migrate\` | Run Prisma migrations |
| \`{{packageManager}} run db:seed\` | Seed the database |
| \`{{packageManager}} run docker:up\` | Start services via Docker Compose |

## Environment Variables

Copy \`.env.example\` to \`.env\` and update:

| Variable | Description |
| --- | --- |
| \`JWT_SECRET\` | **Required.** Min 32 chars. Use \`openssl rand -hex 32\`. |
| \`DATABASE_URL\` | PostgreSQL connection string. |
| \`CORS_ORIGINS\` | Comma-separated allowed origins. |
| \`STORAGE_PROVIDER\` | \`local\` / \`s3\` / \`r2\` / \`minio\`. |

## Production with Docker

Pre-built images are published to the GitHub Container Registry on every release.
See \`docker-compose.yml\` for the full configuration.

\`\`\`bash
{{packageManager}} run docker:up
\`\`\`

## Documentation

Full documentation: **https://docs.kast.dev**
`;

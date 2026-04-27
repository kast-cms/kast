export const README_TEMPLATE = `# {{projectName}}

> Powered by [Kast CMS](https://kast.dev) — Cast Your Content Everywhere.

## Quick Start

\`\`\`bash
# 1. Configure environment
cp .env.example .env
# Edit .env — update JWT_SECRET at minimum

# 2. Start all services
docker-compose up

# 3. Open the admin panel
open http://localhost:3001/admin
\`\`\`

## Services

| Service       | URL                                        |
| ------------- | ------------------------------------------ |
| Admin Panel   | http://localhost:3001/admin                |
| REST API      | http://localhost:{{apiPort}}/api/v1        |
| MCP Server    | http://localhost:{{apiPort}}/mcp           |
| API Docs      | http://localhost:{{apiPort}}/api/docs      |
| Health Check  | http://localhost:{{apiPort}}/api/v1/health |
{{#if includeFrontend}}| Frontend      | http://localhost:3002                      |{{/if}}
{{#if includeMeilisearch}}| Meilisearch   | http://localhost:7700                      |{{/if}}

## Project Structure

\`\`\`
{{projectName}}/
├── apps/
│   ├── api/               # NestJS REST API + MCP server
│   └── admin/             # Next.js admin panel
{{#if includeFrontend}}│   └── web/               # Next.js {{frontendStarter}} frontend
{{/if}}├── packages/
│   └── sdk/               # @kast-cms/sdk — typed API client
├── plugins/               # Installed Kast plugins
├── docker-compose.yml
├── .env.example
└── .env                   # (gitignored)
\`\`\`

## Environment Variables

Copy \`.env.example\` to \`.env\` and update:

| Variable | Description |
| --- | --- |
| \`JWT_SECRET\` | **Required.** Min 32 chars. Use \`openssl rand -hex 32\`. |
| \`DATABASE_URL\` | PostgreSQL connection string. |
| \`CORS_ORIGINS\` | Comma-separated allowed origins. |
| \`STORAGE_PROVIDER\` | \`local\` / \`s3\` / \`r2\` / \`minio\`. |

## Documentation

Full documentation: **https://docs.kast.dev**

## License

MIT
`;

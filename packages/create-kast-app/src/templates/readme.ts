export const README_TEMPLATE = `# {{projectName}}

> Powered by [Kast CMS](https://kast.dev) — Cast Your Content Everywhere.

## Quick Start

\`\`\`bash
# 1. Configure environment
#    (create-kast-app already wrote a .env with generated secrets — this is only
#     needed if you cloned the project instead of scaffolding it)
cp .env.example .env
# Edit .env — set DATABASE_URL, and replace every "replace_me..." placeholder

# 2. Run database migrations
{{packageManager}} run db:migrate

# 3. Seed reference data (locales, roles, settings — no user accounts)
{{packageManager}} run db:seed

# 4. Start all services in development mode
{{packageManager}} run dev
\`\`\`
{{#if includeAdmin}}
The admin panel opens at **http://localhost:3001/admin**.
{{/if}}
### First run — create your owner account

Kast ships **no default credentials**: a freshly migrated database contains no
users at all, so there is nothing to guess and nothing to rotate.
{{#if includeAdmin}}
Create the first owner from the browser:

1. Start the stack (\`{{packageManager}} run dev\`).
2. Open **http://localhost:3001/admin/setup**.
3. Fill in name, email and a password of at least 8 characters.
4. You are redirected to **/admin/login** — sign in with what you just chose.

That page posts to \`POST /api/v1/auth/setup\`, which only works while the user
table is empty. \`GET /api/v1/auth/setup\` reports whether the install still
needs an owner. Both routes close permanently as soon as one user exists, and
the creation is serialised with a Postgres advisory lock so two concurrent
requests cannot both win.
{{else}}
Create the first owner over HTTP while the user table is still empty:

\`\`\`bash
curl -s http://localhost:{{apiPort}}/api/v1/auth/setup
# -> {"data":{"required":true}}

curl -sX POST http://localhost:{{apiPort}}/api/v1/auth/setup \\
  -H 'Content-Type: application/json' \\
  -d '{"email":"you@example.com","password":"a-strong-password","firstName":"Ada","lastName":"Lovelace"}'
\`\`\`

Both routes close permanently as soon as one user exists, and the creation is
serialised with a Postgres advisory lock so two concurrent requests cannot both
win. Log in afterwards at \`POST /api/v1/auth/login\`.
{{/if}}
#### Headless / CI installs

When no browser and no HTTP call is practical, the seed can provision the owner
instead. It never invents a password you do not control:

\`\`\`bash
# Password you supply (minimum 12 characters)
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='...' {{packageManager}} run db:seed

# Or omit the password and the seed generates one and prints it once to stderr
SEED_ADMIN_EMAIL=you@example.com {{packageManager}} run db:seed
\`\`\`

Re-running it against an account that already exists leaves that account's
password untouched. Both variables are refused outright when
\`NODE_ENV=production\`.

> \`SEED_DEV_ACCOUNTS=i-know-these-credentials-are-public\` also exists. It
> recreates well-known throwaway logins (\`admin@kast.local\` / \`Admin1234!\`) for
> local demos only. The credentials are published, the opt-in phrase is refused
> under \`NODE_ENV=production\`, and the API logs a standing warning for as long
> as such an account still carries its published password.

## Services

| Service       | URL                                        |
| ------------- | ------------------------------------------ |
| Admin Panel   | http://localhost:3001/admin                |
| REST API      | http://localhost:{{apiPort}}/api/v1        |
| MCP Server    | http://localhost:{{apiPort}}/api/v1/mcp    |
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
| \`{{packageManager}} run db:seed\` | Seed reference data (locales, roles, settings) — creates no user account |
| \`{{packageManager}} run docker:up\` | Start services via Docker Compose |

## Environment Variables

Copy \`.env.example\` to \`.env\` and update:

| Variable | Description |
| --- | --- |
| \`JWT_SECRET\` | **Required.** Min 32 chars. Use \`openssl rand -hex 32\`. |
| \`DATABASE_URL\` | PostgreSQL connection string. |
| \`CORS_ORIGINS\` | Comma-separated allowed origins. |
| \`STORAGE_PROVIDER\` | \`local\` / \`s3\` / \`r2\`. |

## Production with Docker

Pre-built images are published to the GitHub Container Registry on every release.
See \`docker-compose.yml\` for the full configuration.

\`\`\`bash
{{packageManager}} run docker:up
\`\`\`

## Documentation

Full documentation: **https://docs.kast.dev**
`;

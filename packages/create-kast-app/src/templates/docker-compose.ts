// docker-compose.yml Handlebars template for generated projects.
// This file is provided for running Kast CMS with Docker (local dev or production).
// For local development without Docker, run: <pm> run dev
export const DOCKER_COMPOSE_TEMPLATE = `# ── Docker Compose ─────────────────────────────────────────────────────────
# Use this file to run Kast CMS with Docker.
# For local development without Docker, run: {{packageManager}} run dev
#
# The API service overrides the host-only DATABASE_URL and REDIS_HOST values
# from .env so docker compose up works without changing local dev settings.
# ─────────────────────────────────────────────────────────────────────────────

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: \${POSTGRES_USER:-kast}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-kast_secret}
      POSTGRES_DB: \${POSTGRES_DB:-kast_db}
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U \${POSTGRES_USER:-kast} -d \${POSTGRES_DB:-kast_db}']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    image: ghcr.io/kast-cms/kast-api:latest
    restart: unless-stopped
    env_file: .env
    environment:
      DATABASE_URL: postgresql://\${POSTGRES_USER:-kast}:\${POSTGRES_PASSWORD:-kast_secret}@postgres:5432/\${POSTGRES_DB:-kast_db}
      REDIS_HOST: redis
      STORAGE_LOCAL_DIR: /app/uploads
    command: sh -c "node_modules/.bin/prisma migrate deploy && node dist/main.js"
    ports:
      - '{{apiPort}}:3000'
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - uploads:/app/uploads
{{#if includeAdmin}}
  admin:
    image: ghcr.io/kast-cms/kast-admin:latest
    restart: unless-stopped
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:{{apiPort}}
      - INTERNAL_API_URL=http://api:3000
    ports:
      - '3001:3001'
    depends_on:
      - api
{{/if}}
{{#if includeFrontend}}
  web:
    image: ghcr.io/kast-cms/web-{{frontendStarter}}:latest
    restart: unless-stopped
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:{{apiPort}}
    ports:
      - '3002:3002'
    depends_on:
      - api
{{/if}}
{{#if includeMeilisearch}}
  meilisearch:
    image: getmeili/meilisearch:v1.6
    restart: unless-stopped
    ports:
      - '7700:7700'
    environment:
      - MEILI_MASTER_KEY=\${MEILISEARCH_API_KEY:-masterKey}
    volumes:
      - meilisearch_data:/meili_data
{{/if}}
volumes:
  postgres_data:
  redis_data:
  uploads:
{{#if includeMeilisearch}}
  meilisearch_data:
{{/if}}
`;

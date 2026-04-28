// docker-compose.yml Handlebars template for generated projects.
// This file is provided for PRODUCTION deployments using pre-built images.
// For local development, use: <pm> run dev  (starts the source directly)
export const DOCKER_COMPOSE_TEMPLATE = `# ── Production Docker Compose ─────────────────────────────────────────────────
# Use this file to run Kast CMS with the pre-built Docker images.
# For local development, run: {{packageManager}} run dev
#
# Images are built from: https://github.com/kast-cms/kast
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
    ports:
      - '{{apiPort}}:3000'
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - uploads:/app/uploads

  admin:
    image: ghcr.io/kast-cms/kast-admin:latest
    restart: unless-stopped
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:{{apiPort}}/api/v1
    ports:
      - '3001:3001'
    depends_on:
      - api
{{#if includeFrontend}}
  web:
    image: ghcr.io/kast-cms/web-{{frontendStarter}}:latest
    restart: unless-stopped
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:{{apiPort}}/api/v1
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


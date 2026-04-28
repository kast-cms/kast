export const ENV_EXAMPLE_TEMPLATE = `# =============================================================================
# {{projectName}} — Kast CMS Environment Variables
# =============================================================================
# Copy this file to .env before starting: cp .env.example .env
# DO NOT commit .env to version control.
# =============================================================================

# ---------------------------------------------------------------------------
# Server
# ---------------------------------------------------------------------------
NODE_ENV=development
PORT=3000
SITE_URL=http://localhost:{{apiPort}}

# ---------------------------------------------------------------------------
# Database (PostgreSQL)
# ---------------------------------------------------------------------------
POSTGRES_USER=kast
POSTGRES_PASSWORD=kast_secret
POSTGRES_DB=kast_db
DATABASE_URL=postgresql://kast:kast_secret@localhost:5432/kast_db

# ---------------------------------------------------------------------------
# Redis
# ---------------------------------------------------------------------------
REDIS_HOST=redis
REDIS_PORT=6379
# REDIS_PASSWORD=

# ---------------------------------------------------------------------------
# JWT — CHANGE THIS IN PRODUCTION
# ---------------------------------------------------------------------------
# Generate a strong secret: openssl rand -hex 32
JWT_SECRET=replace_me_with_a_32_character_secret_at_minimum_length
JWT_EXPIRES_IN=15m

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
# Comma-separated list of allowed origins. Do not use * in production.
CORS_ORIGINS=http://localhost:3001,http://localhost:3002

# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------
STORAGE_PROVIDER={{storageProvider}}
STORAGE_LOCAL_DIR=./uploads
STORAGE_LOCAL_URL=http://localhost:{{apiPort}}/uploads
{{#if storageIsCloud}}

# Cloud storage (required when STORAGE_PROVIDER is s3, r2, or minio)
AWS_REGION=auto
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET={{projectName}}-media
# For R2 or MinIO, set the custom endpoint:
# AWS_S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
{{/if}}

# ---------------------------------------------------------------------------
# Uploads
# ---------------------------------------------------------------------------
UPLOAD_MAX_FILE_SIZE_MB=50
UPLOAD_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp,image/gif,image/svg+xml,application/pdf

# ---------------------------------------------------------------------------
# SMTP (Email / Queue notifications)
# ---------------------------------------------------------------------------
# For local development use Mailhog: docker run -p 1025:1025 -p 8025:8025 mailhog/mailhog
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
# SMTP_USER=
# SMTP_PASS=
SMTP_FROM=noreply@{{projectName}}.local
{{#if pluginMeilisearch}}

# ---------------------------------------------------------------------------
# Meilisearch (@kast-cms/plugin-meilisearch)
# ---------------------------------------------------------------------------
MEILISEARCH_HOST=http://meilisearch:7700
MEILISEARCH_API_KEY=masterKey
{{/if}}
{{#if pluginStripe}}

# ---------------------------------------------------------------------------
# Stripe (@kast-cms/plugin-stripe)
# ---------------------------------------------------------------------------
STRIPE_SECRET_KEY=sk_test_replace_me
STRIPE_WEBHOOK_SECRET=whsec_replace_me
{{/if}}
{{#if pluginResend}}

# ---------------------------------------------------------------------------
# Resend (@kast-cms/plugin-resend)
# ---------------------------------------------------------------------------
RESEND_API_KEY=re_replace_me
{{/if}}
{{#if pluginR2}}

# ---------------------------------------------------------------------------
# Cloudflare R2 (@kast-cms/plugin-r2)
# ---------------------------------------------------------------------------
# R2 endpoint format: https://<account_id>.r2.cloudflarestorage.com
CF_R2_ACCOUNT_ID=
CF_R2_ACCESS_KEY_ID=
CF_R2_SECRET_ACCESS_KEY=
CF_R2_BUCKET={{projectName}}-media
CF_R2_PUBLIC_URL=https://media.{{projectName}}.dev
{{/if}}
{{#if pluginSentry}}

# ---------------------------------------------------------------------------
# Sentry (@kast-cms/plugin-sentry)
# ---------------------------------------------------------------------------
SENTRY_DSN=https://replace_me@sentry.io/replace_me
{{/if}}
`;

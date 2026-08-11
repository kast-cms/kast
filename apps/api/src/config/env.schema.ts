import { z } from 'zod';

/**
 * Every variable the API — or a plugin the API loads in-process — reads from
 * `process.env` has to be declared here, even when nothing in this package uses
 * it. @nestjs/config parses `.env` into a plain object, validates it, and assigns
 * the *validated* result back onto `process.env`; zod strips keys this schema
 * does not declare, so an undeclared name set in `.env` is silently discarded and
 * can never reach its reader.
 */
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis — accepts either REDIS_URL (e.g. Railway/Render) or individual vars
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),

  // Encrypts secret settings (e.g. smtp.password) at rest. Falls back to
  // JWT_SECRET when unset, which means rotating JWT_SECRET would make existing
  // ciphertext unreadable — set this explicitly in production. The blank form is
  // accepted because .env.example ships the key with no value.
  KAST_SECRET_ENCRYPTION_KEY: z.union([z.string().min(32), z.literal('')]).optional(),

  // Authorises the publicly documented admin@kast.local / writer@kast.local
  // logins, both for `db:seed` and for this API's startup credential check. Only
  // the opt-in phrase in weak-credential.util.ts counts; see it for why.
  SEED_DEV_ACCOUNTS: z.string().optional(),

  // Loopback callback into this same API, used by the in-process first-party
  // plugins (Meilisearch indexing, Stripe product sync) to read entries. Blank
  // means "not configured"; those plugins then stay idle.
  KAST_API_URL: z.union([z.string().url(), z.literal('')]).optional(),
  KAST_API_TOKEN: z.string().optional(),
  KAST_API_KEY: z.string().optional(),

  // Comma/space separated hosts webhooks may target despite resolving to a
  // private address. Empty (the default) means default-deny.
  WEBHOOK_ALLOWED_HOSTS: z.string().optional(),

  // CORS
  CORS_ORIGINS: z.string().default('*'),

  // Storage
  STORAGE_PROVIDER: z.enum(['local', 's3', 'r2', 'gcs']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./uploads'),
  STORAGE_LOCAL_URL: z.string().default('http://localhost:3000/uploads'),

  // AWS S3 (optional — required if STORAGE_PROVIDER=s3 or r2)
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_S3_ENDPOINT: z.string().optional(),

  // Upload limits
  UPLOAD_MAX_FILE_SIZE_MB: z.coerce.number().int().default(50),
  UPLOAD_ALLOWED_MIME_TYPES: z
    .string()
    .default('image/jpeg,image/png,image/webp,image/gif,image/svg+xml,application/pdf'),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  SITE_URL: z.string().default('http://localhost:3000'),
  /**
   * Origin of the admin panel. It embeds the Bull board in an iframe, so it has
   * to be named in the API's frame-ancestors directive or the browser blocks the
   * queue monitor.
   */
  ADMIN_URL: z.string().default('http://localhost:3001'),

  // SMTP (email queue)
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('noreply@kast.io'),

  // Resend (alternative email transport — used by kast-plugin-resend)
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  RESEND_FROM_NAME: z.string().optional(),

  // Meilisearch (used by kast-plugin-meilisearch)
  MEILISEARCH_HOST: z.string().optional(),
  MEILISEARCH_MASTER_KEY: z.string().optional(),
  MEILISEARCH_INDEX_PREFIX: z.string().default('kast_'),
  // 'false' disables the cross-type aggregate index the search endpoint reads.
  MEILISEARCH_AGGREGATE_INDEX: z.string().optional(),

  // Cloudflare R2 (used by kast-plugin-r2)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),

  // Stripe (used by kast-plugin-stripe)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRODUCT_TYPE_SLUG: z.string().default('product'),

  // Sentry (used by kast-plugin-sentry)
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.errors.map((e) => `  ${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Environment validation failed:\n${errors}`);
  }
  return result.data;
}

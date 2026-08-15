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
  // Compose consumes these from the same .env. Declaring them prevents
  // @nestjs/config from stripping them when it replaces process.env.
  POSTGRES_USER: z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),
  POSTGRES_DB: z.string().optional(),

  // Redis — accepts either REDIS_URL (e.g. Railway/Render) or individual vars
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  QUEUE_BACKLOG_ALERT_THRESHOLD: z.coerce.number().int().positive().default(1000),
  QUEUE_FAILED_ALERT_THRESHOLD: z.coerce.number().int().positive().default(100),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),

  // Encrypts secret settings (e.g. smtp.password) at rest. Falls back to
  // JWT_SECRET when unset, which means rotating JWT_SECRET would make existing
  // ciphertext unreadable — set this explicitly in production. The blank form is
  // accepted because .env.example ships the key with no value.
  KAST_SECRET_ENCRYPTION_KEY: z.union([z.string().min(32), z.literal('')]).optional(),
  // Comma-separated retired keys used only to decrypt and lazily re-encrypt
  // existing secrets during a controlled rotation.
  KAST_SECRET_ENCRYPTION_PREVIOUS_KEYS: z.string().optional(),

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

  /**
   * Express `trust proxy` setting. Governs `req.ip`, which is both the address
   * stored against a public form submission and the key the rate limiter counts
   * on, so it is decided once for the whole app rather than per module.
   *
   * Default 'false' is the safe one: an untrusted `x-forwarded-for` would let
   * any caller both forge the recorded IP and mint a fresh rate-limit bucket per
   * request. Behind a reverse proxy set it to the number of proxies in front of
   * this app ('1' for a single nginx/ALB), a specific IP/CIDR, or 'true' to
   * trust the leftmost entry — only ever with a proxy that overwrites the header.
   */
  TRUST_PROXY: z.string().default('false'),

  // Storage
  STORAGE_PROVIDER: z.enum(['local', 's3', 'r2']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./uploads'),
  // Public base URL for locally stored objects. The default points at the route
  // this API actually serves; override it only when a proxy or CDN fronts
  // STORAGE_LOCAL_DIR itself.
  STORAGE_LOCAL_URL: z.string().default('http://localhost:3000/api/v1/media/files'),

  // AWS S3 (optional — required if STORAGE_PROVIDER=s3 or r2)
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_S3_ENDPOINT: z.string().optional(),

  // Upload limits
  UPLOAD_MAX_FILE_SIZE_MB: z.coerce.number().int().positive().max(1024).default(50),
  // image/svg+xml is deliberately absent: an SVG is a script-bearing document
  // and nothing here sanitises one. Adding it back opts into serving it as a
  // forced download (see media.constants.ts) from whatever origin holds it.
  UPLOAD_ALLOWED_MIME_TYPES: z
    .string()
    .default('image/jpeg,image/png,image/webp,image/gif,application/pdf'),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  SITE_URL: z.string().default('http://localhost:3000'),
  /**
   * Public base URL of the admin panel, INCLUDING its base path. The Next.js
   * app sets `basePath: '/admin'`, so every link the API mints — the OAuth
   * callback, password-reset and invite emails — 404s without it. main.ts
   * reduces this to a bare origin where an origin is what is wanted (the CSP
   * frame-ancestors entry that lets the admin embed the Bull board).
   */
  ADMIN_URL: z.string().default('http://localhost:3001/admin'),

  /**
   * Whether an OAuth identity with no matching account may create one.
   *   disabled  (default) — sign-in only; an unknown address is refused
   *   allowlist — provision when the email domain is in OAUTH_SIGNUP_ALLOWED_DOMAINS
   *   open      — provision any address the provider asserts
   * Fail-closed: an unrecognised value falls back to `disabled`.
   */
  OAUTH_SIGNUP_MODE: z.enum(['disabled', 'allowlist', 'open']).default('disabled'),
  /** Comma-separated domains for OAUTH_SIGNUP_MODE=allowlist. */
  OAUTH_SIGNUP_ALLOWED_DOMAINS: z.string().default(''),
  /**
   * Require the provider to positively assert a verified address before
   * provisioning. Set 'false' only for providers that omit the claim (GitHub).
   * Left as a string, not coerced: OAuthPolicy parses it and must see the same
   * value whether it came from this schema or straight from the environment.
   */
  OAUTH_SIGNUP_REQUIRE_VERIFIED: z.enum(['true', 'false']).default('true'),

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

function assertProductionEnvironment(env: Env): void {
  if (env.NODE_ENV !== 'production') return;
  if (!env.KAST_SECRET_ENCRYPTION_KEY || env.KAST_SECRET_ENCRYPTION_KEY.length < 32) {
    throw new Error(
      'Environment validation failed:\n  KAST_SECRET_ENCRYPTION_KEY: required in production (minimum 32 characters)',
    );
  }
  if (env.CORS_ORIGINS.trim() === '*') {
    throw new Error(
      'Environment validation failed:\n  CORS_ORIGINS: wildcard origins are forbidden in production',
    );
  }
}

function assertStorageEnvironment(env: Env): void {
  const requirements: Record<Env['STORAGE_PROVIDER'], Array<[string, string | undefined]>> = {
    local: [],
    s3: [
      ['AWS_REGION', env.AWS_REGION],
      ['AWS_ACCESS_KEY_ID', env.AWS_ACCESS_KEY_ID],
      ['AWS_SECRET_ACCESS_KEY', env.AWS_SECRET_ACCESS_KEY],
      ['AWS_S3_BUCKET', env.AWS_S3_BUCKET],
    ],
    r2: [
      ['R2_ACCOUNT_ID', env.R2_ACCOUNT_ID],
      ['R2_ACCESS_KEY_ID', env.R2_ACCESS_KEY_ID],
      ['R2_SECRET_ACCESS_KEY', env.R2_SECRET_ACCESS_KEY],
      ['R2_BUCKET_NAME', env.R2_BUCKET_NAME],
    ],
  };
  const missing = requirements[env.STORAGE_PROVIDER]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(
      `Environment validation failed:\n  STORAGE_PROVIDER: ${env.STORAGE_PROVIDER} requires ${missing.join(', ')}`,
    );
  }
}

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues.map((e) => `  ${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Environment validation failed:\n${errors}`);
  }
  assertProductionEnvironment(result.data);
  assertStorageEnvironment(result.data);
  return result.data;
}

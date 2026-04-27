import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_ADMIN_BASE_PATH: z.string().default('/admin'),
  // Server-only (not exposed to browser)
  INTERNAL_API_URL: z.string().url().optional(),
  REFRESH_TOKEN_COOKIE_NAME: z.string().default('kast_rt'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type AdminEnv = z.infer<typeof envSchema>;

function parseEnv(): AdminEnv {
  const result = envSchema.safeParse({
    NEXT_PUBLIC_API_URL: process.env['NEXT_PUBLIC_API_URL'],
    NEXT_PUBLIC_ADMIN_BASE_PATH: process.env['NEXT_PUBLIC_ADMIN_BASE_PATH'],
    INTERNAL_API_URL: process.env['INTERNAL_API_URL'],
    REFRESH_TOKEN_COOKIE_NAME: process.env['REFRESH_TOKEN_COOKIE_NAME'],
    NODE_ENV: process.env['NODE_ENV'],
  });

  if (!result.success) {
    const errors = result.error.errors.map((e) => `  ${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Admin environment validation failed:\n${errors}`);
  }

  return result.data;
}

export const env = parseEnv();

/** API URL visible to the browser */
export const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000';

/** Internal server-side API URL (falls back to public URL) */
export const INTERNAL_API_URL = process.env['INTERNAL_API_URL'] ?? API_URL;

export const REFRESH_TOKEN_COOKIE = process.env['REFRESH_TOKEN_COOKIE_NAME'] ?? 'kast_rt';

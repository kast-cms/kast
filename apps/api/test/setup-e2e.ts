/**
 * Runs in every Jest worker BEFORE the test modules are imported, so the
 * NestJS ConfigModule (validated by env.schema) sees a complete, test-only
 * environment. Critically it points DATABASE_URL at the isolated `kast_test`
 * database — never the live `kast_db`.
 */
const TEST_DATABASE_URL = process.env.DATABASE_URL?.includes('kast_test')
  ? process.env.DATABASE_URL
  : 'postgresql://kast:kast_secret@127.0.0.1:5432/kast_test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'e2e_test_jwt_secret_at_least_32_characters_long_0';
process.env.JWT_EXPIRES_IN = '15m';
process.env.REDIS_HOST = process.env.REDIS_HOST ?? '127.0.0.1';
process.env.REDIS_PORT = process.env.REDIS_PORT ?? '6379';
process.env.SITE_URL = process.env.SITE_URL ?? 'http://localhost:3000';
process.env.STORAGE_PROVIDER = 'local';
process.env.STORAGE_LOCAL_DIR = process.env.STORAGE_LOCAL_DIR ?? '/tmp/kast-test-uploads';
process.env.CORS_ORIGINS = '*';

/**
 * Provisions the isolated `kast_test` database the e2e suite runs against.
 *
 * `prisma migrate deploy` creates the database when it does not exist yet and
 * then applies every migration, so `pnpm test:e2e` works on a clean checkout
 * instead of failing in globalSetup with "Database `kast_test` does not exist".
 *
 * The URL is resolved exactly like test/setup-e2e.ts and test/global-setup.ts:
 * an explicit DATABASE_URL is honoured only when it already points at a
 * kast_test database, so this can never migrate the live `kast_db`.
 */
import { spawnSync } from 'node:child_process';

const DATABASE_URL = process.env.DATABASE_URL?.includes('kast_test')
  ? process.env.DATABASE_URL
  : 'postgresql://kast:kast_secret@127.0.0.1:5432/kast_test';

const result = spawnSync('prisma', ['migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL },
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(`Could not run "prisma migrate deploy": ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);

import { readFileSync } from 'fs';
import { join } from 'path';
import { validateEnv } from './env.schema';

/**
 * @nestjs/config validates the merged `.env` + process env and then assigns the
 * VALIDATED object back onto process.env. Because the schema is a plain
 * z.object (strip mode), anything it does not declare is deleted on the way
 * through — so a variable documented in .env.example but missing from the schema
 * is unreachable from a .env file no matter how correctly the operator sets it.
 * These tests pin that contract from both ends.
 */
const REPO_ROOT = join(__dirname, '..', '..', '..', '..');

const BASE_ENV = {
  DATABASE_URL: 'postgresql://kast:kast_secret@localhost:5432/kast_db',
  JWT_SECRET: 'a'.repeat(32),
};

function parseEnvFile(contents: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    parsed[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
  }
  return parsed;
}

describe('validateEnv', () => {
  describe('variables read straight from process.env', () => {
    it('preserves the plugin API credentials instead of stripping them', () => {
      const env = validateEnv({
        ...BASE_ENV,
        KAST_API_URL: 'https://cms.example.com',
        KAST_API_TOKEN: 'kast_read_only_token',
        KAST_API_KEY: 'kast_legacy_alias',
      });

      expect(env.KAST_API_URL).toBe('https://cms.example.com');
      expect(env.KAST_API_TOKEN).toBe('kast_read_only_token');
      expect(env.KAST_API_KEY).toBe('kast_legacy_alias');
    });

    it('preserves the Meilisearch aggregate-index switch', () => {
      const env = validateEnv({ ...BASE_ENV, MEILISEARCH_AGGREGATE_INDEX: 'false' });

      expect(env.MEILISEARCH_AGGREGATE_INDEX).toBe('false');
    });

    it('preserves the dev-account opt-in the startup credential check reads', () => {
      const env = validateEnv({
        ...BASE_ENV,
        SEED_DEV_ACCOUNTS: 'i-know-these-credentials-are-public',
      });

      expect(env.SEED_DEV_ACCOUNTS).toBe('i-know-these-credentials-are-public');
    });

    it('rejects a KAST_API_URL that is not a URL', () => {
      expect(() => validateEnv({ ...BASE_ENV, KAST_API_URL: 'not-a-url' })).toThrow(/KAST_API_URL/);
    });

    it('accepts the blank placeholders .env.example ships', () => {
      const env = validateEnv({
        ...BASE_ENV,
        KAST_API_URL: '',
        KAST_API_TOKEN: '',
        KAST_SECRET_ENCRYPTION_KEY: '',
      });

      expect(env.KAST_API_TOKEN).toBe('');
    });
  });

  describe('.env.example', () => {
    const example = parseEnvFile(readFileSync(join(REPO_ROOT, '.env.example'), 'utf8'));

    it('validates verbatim, so `cp .env.example .env` boots', () => {
      expect(() => validateEnv(example)).not.toThrow();
    });

    it('declares every variable it documents, so none is stripped', () => {
      const validated = validateEnv(example) as Record<string, unknown>;

      expect(Object.keys(example).filter((key) => !(key in validated))).toEqual([]);
    });

    it('does not pin NODE_ENV, which would follow a copied .env onto a real server', () => {
      expect(example['NODE_ENV']).toBeUndefined();
    });

    it('does not enable the public development logins', () => {
      expect(example['SEED_DEV_ACCOUNTS']).toBeUndefined();
    });
  });
});

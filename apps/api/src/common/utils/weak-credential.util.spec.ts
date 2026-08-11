import * as argon2 from 'argon2';
import {
  assertNoKnownWeakCredentials,
  DEV_ACCOUNTS,
  DEV_ACCOUNTS_OPT_IN,
  findKnownWeakCredentials,
  resolveDevAccountsDecision,
  type UserCredentialStore,
  type WeakCredentialLogger,
} from './weak-credential.util';

/**
 * P0-05 asks for "a startup warning/refusal for known test credentials". The seed
 * guard cannot cover a database that was seeded before it existed, so the check
 * has to run against live rows at boot.
 */
describe('known weak credential check (P0-05)', () => {
  let adminHash: string;
  let writerHash: string;
  let rotatedHash: string;

  beforeAll(async () => {
    adminHash = await argon2.hash('Admin1234!', { type: argon2.argon2id });
    writerHash = await argon2.hash('Writer1234!', { type: argon2.argon2id });
    rotatedHash = await argon2.hash('a-properly-rotated-secret', { type: argon2.argon2id });
  }, 30_000);

  function store(rows: Array<{ email: string; passwordHash: string | null }>): UserCredentialStore {
    return { findMany: jest.fn().mockResolvedValue(rows) };
  }

  describe('findKnownWeakCredentials', () => {
    it('flags a seeded admin whose password was never rotated', async () => {
      const found = await findKnownWeakCredentials(
        store([{ email: 'admin@kast.local', passwordHash: adminHash }]),
      );

      expect(found).toEqual(['admin@kast.local']);
    });

    it('flags both seeded dev accounts', async () => {
      const found = await findKnownWeakCredentials(
        store([
          { email: 'admin@kast.local', passwordHash: adminHash },
          { email: 'writer@kast.local', passwordHash: writerHash },
        ]),
      );

      expect(found).toEqual(['admin@kast.local', 'writer@kast.local']);
    });

    it('accepts a rotated password on an account that still exists', async () => {
      const found = await findKnownWeakCredentials(
        store([{ email: 'admin@kast.local', passwordHash: rotatedHash }]),
      );

      expect(found).toEqual([]);
    });

    it('returns nothing for a clean database', async () => {
      expect(await findKnownWeakCredentials(store([]))).toEqual([]);
    });

    it('ignores an account with no password hash (SSO-only)', async () => {
      const found = await findKnownWeakCredentials(
        store([{ email: 'admin@kast.local', passwordHash: null }]),
      );

      expect(found).toEqual([]);
    });

    it('queries only the known dev emails', async () => {
      const users = store([]);
      await findKnownWeakCredentials(users);

      expect(users.findMany).toHaveBeenCalledWith({
        where: { email: { in: ['admin@kast.local', 'writer@kast.local'] } },
        select: { email: true, passwordHash: true },
      });
    });
  });

  /**
   * The refuse-when-NODE_ENV=production form of this guard was defeated by the
   * project's own defaults: .env.example shipped NODE_ENV=development and
   * docker-compose loaded it with env_file, so a real deployment reported
   * "development" and neither the seed nor the boot check ever fired.
   */
  describe('resolveDevAccountsDecision', () => {
    it('refuses the old SEED_DEV_ACCOUNTS=1 opt-in on an install that reports development', () => {
      const decision = resolveDevAccountsDecision({
        NODE_ENV: 'development',
        SEED_DEV_ACCOUNTS: '1',
      });

      expect(decision.allowed).toBe(false);
    });

    it.each(['true', 'yes', 'on', '0', ''])(
      'refuses the boolean-ish opt-in %p',
      (value: string) => {
        expect(
          resolveDevAccountsDecision({ NODE_ENV: 'development', SEED_DEV_ACCOUNTS: value }).allowed,
        ).toBe(false);
      },
    );

    it('refuses when NODE_ENV is absent entirely (the schema default is development)', () => {
      expect(resolveDevAccountsDecision({}).allowed).toBe(false);
    });

    it('allows the explicit opt-in phrase', () => {
      expect(resolveDevAccountsDecision({ SEED_DEV_ACCOUNTS: DEV_ACCOUNTS_OPT_IN }).allowed).toBe(
        true,
      );
    });

    it('tolerates surrounding whitespace on the phrase', () => {
      expect(
        resolveDevAccountsDecision({ SEED_DEV_ACCOUNTS: ` ${DEV_ACCOUNTS_OPT_IN}\n` }).allowed,
      ).toBe(true);
    });

    it('refuses the phrase outright in production', () => {
      const decision = resolveDevAccountsDecision({
        NODE_ENV: 'production',
        SEED_DEV_ACCOUNTS: DEV_ACCOUNTS_OPT_IN,
      });

      expect(decision.allowed).toBe(false);
      expect(decision.allowed === false && decision.reason).toMatch(/NODE_ENV=production/);
    });

    it('covers exactly the accounts the boot check looks for', () => {
      expect(DEV_ACCOUNTS.map((account) => account.email)).toEqual([
        'admin@kast.local',
        'writer@kast.local',
      ]);
    });
  });

  describe('assertNoKnownWeakCredentials', () => {
    it('refuses to boot in production when a known credential is live', async () => {
      await expect(
        assertNoKnownWeakCredentials(
          store([{ email: 'admin@kast.local', passwordHash: adminHash }]),
          'production',
        ),
      ).rejects.toThrow(/Refusing to start.*admin@kast\.local/s);
    });

    it('refuses to boot on a deployment that merely reports development', async () => {
      const logger = { warn: jest.fn() } as WeakCredentialLogger;

      await expect(
        assertNoKnownWeakCredentials(
          store([{ email: 'admin@kast.local', passwordHash: adminHash }]),
          { NODE_ENV: 'development' },
          logger,
        ),
      ).rejects.toThrow(/Refusing to start.*admin@kast\.local/s);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('refuses to boot when the opt-in is the old SEED_DEV_ACCOUNTS=1', async () => {
      await expect(
        assertNoKnownWeakCredentials(
          store([{ email: 'admin@kast.local', passwordHash: adminHash }]),
          { NODE_ENV: 'development', SEED_DEV_ACCOUNTS: '1' },
          { warn: jest.fn() },
        ),
      ).rejects.toThrow(/Refusing to start/);
    });

    it('only warns once the operator opted in, so local development still works', async () => {
      const logger = { warn: jest.fn() } as WeakCredentialLogger;

      await expect(
        assertNoKnownWeakCredentials(
          store([{ email: 'admin@kast.local', passwordHash: adminHash }]),
          { NODE_ENV: 'development', SEED_DEV_ACCOUNTS: DEV_ACCOUNTS_OPT_IN },
          logger,
        ),
      ).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('admin@kast.local'));
    });

    it('stays silent in production once the passwords are rotated', async () => {
      const logger = { warn: jest.fn() } as WeakCredentialLogger;

      await expect(
        assertNoKnownWeakCredentials(
          store([{ email: 'admin@kast.local', passwordHash: rotatedHash }]),
          'production',
          logger,
        ),
      ).resolves.toBeUndefined();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});

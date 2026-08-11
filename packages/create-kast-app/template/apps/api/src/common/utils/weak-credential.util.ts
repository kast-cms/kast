import * as argon2 from 'argon2';

/**
 * The fixed local-development logins. They are published in the README, so any
 * database holding them is one lookup away from a super-admin takeover. The seed
 * script that creates them and the API that refuses to serve while they are live
 * both read this list, so the two can never drift apart.
 */
export const DEV_ACCOUNTS = [
  {
    email: 'admin@kast.local',
    password: 'Admin1234!',
    firstName: 'Kast',
    lastName: 'Admin',
    role: 'super_admin',
  },
  {
    email: 'writer@kast.local',
    password: 'Writer1234!',
    firstName: 'Kast',
    lastName: 'Writer',
    role: 'editor',
  },
] as const;

export const DEV_ACCOUNTS_ENV_VAR = 'SEED_DEV_ACCOUNTS';

/**
 * The only accepted value of SEED_DEV_ACCOUNTS. A sentence rather than `1` or
 * `true` because the guard has to hold on a server whose `.env` was copied from
 * `.env.example` on day one and never revisited: `NODE_ENV=development`, `1` and
 * `true` are all values a real deployment ends up carrying by accident, and a
 * guard keyed on any of them is no guard at all. This phrase cannot be typed
 * without meaning it, and it is never written into `.env.example`.
 */
export const DEV_ACCOUNTS_OPT_IN = 'i-know-these-credentials-are-public';

const KNOWN_DEV_CREDENTIALS: ReadonlyArray<readonly [string, string]> = DEV_ACCOUNTS.map(
  (account) => [account.email, account.password] as const,
);

/** The subset of the environment that decides whether the dev logins are allowed. */
export interface DeploymentEnv {
  NODE_ENV?: string | undefined;
  SEED_DEV_ACCOUNTS?: string | undefined;
}

export type DevAccountsDecision = { allowed: true } | { allowed: false; reason: string };

/**
 * Whether this environment may create, or keep serving with, the publicly
 * documented development logins. Deliberately does NOT treat "not production" as
 * permission: NODE_ENV is operator-supplied configuration that deployments
 * routinely leave at `development`, so it can only ever tighten the answer.
 */
export function resolveDevAccountsDecision(env: DeploymentEnv): DevAccountsDecision {
  if (env.NODE_ENV === 'production') {
    return {
      allowed: false,
      reason: `${DEV_ACCOUNTS_ENV_VAR} is never honoured while NODE_ENV=production.`,
    };
  }
  if (env.SEED_DEV_ACCOUNTS?.trim() !== DEV_ACCOUNTS_OPT_IN) {
    return {
      allowed: false,
      reason:
        `The publicly documented logins require ${DEV_ACCOUNTS_ENV_VAR}=${DEV_ACCOUNTS_OPT_IN}, ` +
        `which belongs only on a machine nobody else can reach.`,
    };
  }
  return { allowed: true };
}

export interface UserCredentialStore {
  findMany(args: {
    where: { email: { in: string[] } };
    select: { email: true; passwordHash: true };
  }): Promise<Array<{ email: string; passwordHash: string | null }>>;
}

/** Returns the emails whose stored hash still matches the publicly documented password. */
export async function findKnownWeakCredentials(users: UserCredentialStore): Promise<string[]> {
  const rows = await users.findMany({
    where: { email: { in: KNOWN_DEV_CREDENTIALS.map(([email]) => email) } },
    select: { email: true, passwordHash: true },
  });

  const matched: string[] = [];
  for (const [email, password] of KNOWN_DEV_CREDENTIALS) {
    const row = rows.find((r) => r.email === email);
    if (!row?.passwordHash) continue;
    // A rotated password leaves the account in place but no longer matches, which
    // is exactly the remediation we want to accept.
    const stillWeak = await argon2.verify(row.passwordHash, password).catch(() => false);
    if (stillWeak) matched.push(email);
  }
  return matched;
}

/** Anything with a `warn` method — @nestjs/common's Logger satisfies it. */
export interface WeakCredentialLogger {
  warn(message: string): void;
}

/**
 * Refuses to finish booting while a known credential is live, unless this
 * install explicitly opted into them. The seed guard cannot cover a database
 * seeded before it existed or restored from an old dump, so the running API
 * checks the rows themselves.
 *
 * Throws rather than calling `process.exit` so the caller decides how to fail and
 * tests can assert on it.
 */
export async function assertNoKnownWeakCredentials(
  users: UserCredentialStore,
  env: string | DeploymentEnv | undefined,
  logger: WeakCredentialLogger = console,
): Promise<void> {
  const deployment: DeploymentEnv =
    typeof env === 'string' || env === undefined
      ? { NODE_ENV: env, SEED_DEV_ACCOUNTS: process.env[DEV_ACCOUNTS_ENV_VAR] }
      : env;

  const weak = await findKnownWeakCredentials(users);
  if (weak.length === 0) return;

  const accounts = weak.join(', ');
  const decision = resolveDevAccountsDecision(deployment);
  if (!decision.allowed) {
    throw new Error(
      `Refusing to start: ${accounts} still use the publicly documented development password. ` +
        `${decision.reason} Rotate or delete these accounts before serving traffic.`,
    );
  }
  logger.warn(
    `${accounts} use the publicly documented development password. This install opted in with ` +
      `${DEV_ACCOUNTS_ENV_VAR}, so the API is starting anyway — never do that on a reachable host.`,
  );
}

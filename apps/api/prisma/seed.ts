import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import {
  PERMISSION_ACTIONS,
  PERMISSION_RESOURCES,
} from '../src/common/authorization/permission-catalog';
import {
  DEV_ACCOUNTS,
  DEV_ACCOUNTS_ENV_VAR,
  resolveDevAccountsDecision,
} from '../src/common/utils/weak-credential.util';

const prisma = new PrismaClient();

const MIN_PASSWORD_LENGTH = 12;

const LOCALES = {
  en: { name: 'English', nativeName: 'English', direction: 'LTR' as const },
  ar: { name: 'Arabic', nativeName: 'العربية', direction: 'RTL' as const },
  fr: { name: 'French', nativeName: 'Français', direction: 'LTR' as const },
  de: { name: 'German', nativeName: 'Deutsch', direction: 'LTR' as const },
  es: { name: 'Spanish', nativeName: 'Español', direction: 'LTR' as const },
  pt: { name: 'Portuguese', nativeName: 'Português', direction: 'LTR' as const },
  zh: { name: 'Chinese', nativeName: '中文', direction: 'LTR' as const },
  ja: { name: 'Japanese', nativeName: '日本語', direction: 'LTR' as const },
};

async function seedLocales(): Promise<void> {
  const defaultLocale = (process.env.KAST_DEFAULT_LOCALE ?? '').trim() || 'en';
  const requested = (process.env.KAST_INITIAL_LOCALES ?? 'en,ar')
    .split(',')
    .map((code) => code.trim())
    .filter((code) => Object.hasOwn(LOCALES, code));
  const codes = [...new Set([defaultLocale, ...requested])].filter((code) =>
    Object.hasOwn(LOCALES, code),
  ) as Array<keyof typeof LOCALES>;
  for (const code of codes) {
    const locale = LOCALES[code];
    await prisma.locale.upsert({
      where: { code },
      update: { isDefault: code === defaultLocale, isActive: true },
      create: {
        code,
        ...locale,
        isDefault: code === defaultLocale,
        isActive: true,
      },
    });
  }
}

async function seedRoles(): Promise<void> {
  const roles = [
    {
      name: 'super_admin',
      displayName: 'Super Admin',
      description: 'Full system access',
      isSystem: true,
    },
    {
      name: 'admin',
      displayName: 'Admin',
      description: 'Manage content, users, and settings',
      isSystem: true,
    },
    {
      name: 'editor',
      displayName: 'Editor',
      description: 'Create and publish content',
      isSystem: true,
    },
    { name: 'viewer', displayName: 'Viewer', description: 'Read-only access', isSystem: true },
  ];
  for (const r of roles) {
    await prisma.role.upsert({ where: { name: r.name }, update: {}, create: r });
  }
}

async function seedPermissions(): Promise<void> {
  for (const resource of PERMISSION_RESOURCES) {
    for (const action of PERMISSION_ACTIONS) {
      await prisma.permission.upsert({
        where: { resource_action_scope: { resource, action, scope: '*' } },
        create: { resource, action, scope: '*' },
        update: {},
      });
    }
  }
}

async function upsertUser(account: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  resetPassword: boolean;
}): Promise<{ created: boolean }> {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: account.role } });
  const existing = await prisma.user.findUnique({ where: { email: account.email } });
  const passwordHash = await argon2.hash(account.password, { type: argon2.argon2id });
  const user = await prisma.user.upsert({
    where: { email: account.email },
    update: account.resetPassword ? { passwordHash, isActive: true } : {},
    create: {
      email: account.email,
      passwordHash,
      firstName: account.firstName,
      lastName: account.lastName,
      isActive: true,
    },
  });
  // Only ever widen privileges on an account this seed created. Pointing
  // SEED_ADMIN_EMAIL at an address that already exists would otherwise promote a
  // pre-existing low-privilege user to super_admin without saying so.
  if (existing === null || account.resetPassword) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
  }
  return { created: existing === null };
}

function devAccountsRequested(): boolean {
  const configured = process.env[DEV_ACCOUNTS_ENV_VAR]?.trim();
  return (configured !== undefined && configured !== '') || process.argv.includes('--dev-accounts');
}

function printSetupInstructions(): void {
  console.warn(
    'No user account was seeded. Create the first owner at POST /api/v1/auth/setup (or open /admin/setup).',
  );
}

async function seedDevAccounts(): Promise<void> {
  console.error(
    `⚠️  DEV ACCOUNTS — these logins are public knowledge. Remove ${DEV_ACCOUNTS_ENV_VAR} from your environment before this database is reachable by anyone else.`,
  );
  // Passwords are not echoed: the values live in DEV_ACCOUNTS
  // (common/utils/weak-credential.util.ts) and logs must not carry
  // credential-shaped strings, even dev ones.
  for (const account of DEV_ACCOUNTS) {
    await upsertUser({ ...account, resetPassword: true });
    console.error(`   ${account.email} (${account.role})`);
  }
}

async function seedConfiguredOwner(email: string): Promise<void> {
  const configured = process.env.SEED_ADMIN_PASSWORD;
  const generated = configured === undefined ? randomBytes(24).toString('base64url') : undefined;
  const { created } = await upsertUser({
    email,
    password: configured ?? (generated as string),
    firstName: process.env.SEED_ADMIN_FIRST_NAME ?? 'Kast',
    lastName: process.env.SEED_ADMIN_LAST_NAME ?? 'Owner',
    role: 'super_admin',
    // Never silently reset the password of an account that already exists.
    resetPassword: false,
  });

  if (!created) {
    console.warn(
      `${email} already exists — its password and roles were left unchanged. Grant super_admin from the admin panel if that is what you wanted.`,
    );
    return;
  }
  if (generated) {
    console.error(`Generated password for ${email}: ${generated}`);
    console.error('This is shown only once — store it now and change it after first login.');
  }
}

type OwnerPlan = { kind: 'none' } | { kind: 'dev' } | { kind: 'configured'; email: string };

function refuse(message: string): never {
  console.error(message);
  process.exit(1);
}

/**
 * Kast ships no default login. A privileged account is only created when the
 * operator asks for one explicitly, and the publicly documented dev logins need
 * an opt-in phrase no deployment acquires by accident — NODE_ENV alone decides
 * nothing here, because `.env` files carry `development` onto real servers.
 *
 * Resolved before the seed touches the database, so a refusal leaves the
 * database exactly as it was.
 */
function resolveOwnerPlan(): OwnerPlan {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (devAccountsRequested()) {
    const decision = resolveDevAccountsDecision(process.env);
    if (!decision.allowed) {
      refuse(`Refusing to seed the public development logins. ${decision.reason}`);
    }
    return { kind: 'dev' };
  }

  if (process.env.NODE_ENV === 'production' && (adminEmail || adminPassword)) {
    refuse(
      'Refusing to seed a privileged account while NODE_ENV=production. Use POST /api/v1/auth/setup to create the first owner.',
    );
  }
  if (adminPassword !== undefined && adminPassword.length < MIN_PASSWORD_LENGTH) {
    refuse(`SEED_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  return adminEmail ? { kind: 'configured', email: adminEmail } : { kind: 'none' };
}

async function seedOwnerAccount(plan: OwnerPlan): Promise<void> {
  if (plan.kind === 'dev') {
    await seedDevAccounts();
    return;
  }
  if (plan.kind === 'configured') {
    await seedConfiguredOwner(plan.email);
    return;
  }
  printSetupInstructions();
}

async function seedSettings(): Promise<void> {
  await prisma.globalSetting.upsert({
    where: { key: 'site.name' },
    update: {},
    create: { key: 'site.name', value: 'Kast CMS', group: 'site', isPublic: true },
  });
}

async function main(): Promise<void> {
  const ownerPlan = resolveOwnerPlan();
  await seedLocales();
  await seedRoles();
  await seedPermissions();
  await seedOwnerAccount(ownerPlan);
  await seedSettings();
  console.warn('✅ Seed complete');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

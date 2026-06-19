/**
 * Global e2e setup (runs once, before any worker). Resets the isolated
 * `kast_test` database to a known clean state and seeds the baseline rows the
 * API expects (system roles, default locales, the seeded admin, public
 * settings). It deliberately TRUNCATEs rather than `migrate reset` so it is
 * fast and never touches schema/migrations — migrations are applied out-of-band
 * via `prisma migrate deploy` against kast_test before running e2e.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const DATABASE_URL = process.env.DATABASE_URL?.includes('kast_test')
  ? process.env.DATABASE_URL
  : 'postgresql://kast:kast_secret@127.0.0.1:5432/kast_test';

export const SEED_ADMIN_EMAIL = 'admin@kast.local';
export const SEED_ADMIN_PASSWORD = 'Admin1234!';

async function truncateAll(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

async function seedRoles(prisma: PrismaClient): Promise<void> {
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
      description: 'Manage content, users, settings',
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

async function seedLocales(prisma: PrismaClient): Promise<void> {
  await prisma.locale.upsert({
    where: { code: 'en' },
    update: { isActive: true, isDefault: true },
    create: {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      isDefault: true,
      isActive: true,
      direction: 'LTR',
    },
  });
  await prisma.locale.upsert({
    where: { code: 'ar' },
    update: { isActive: true },
    create: {
      code: 'ar',
      name: 'Arabic',
      nativeName: 'العربية',
      isDefault: false,
      isActive: true,
      direction: 'RTL',
    },
  });
}

async function seedAdmin(prisma: PrismaClient): Promise<void> {
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'super_admin' } });
  const passwordHash = await argon2.hash(SEED_ADMIN_PASSWORD, { type: argon2.argon2id });
  const admin = await prisma.user.upsert({
    where: { email: SEED_ADMIN_EMAIL },
    update: { passwordHash, isActive: true },
    create: {
      email: SEED_ADMIN_EMAIL,
      passwordHash,
      firstName: 'Kast',
      lastName: 'Admin',
      isActive: true,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: superAdminRole.id },
  });
}

async function seedSettings(prisma: PrismaClient): Promise<void> {
  await prisma.globalSetting.upsert({
    where: { key: 'site_name' },
    update: {},
    create: { key: 'site_name', value: 'Kast CMS', group: 'general', isPublic: true },
  });
  await prisma.globalSetting.upsert({
    where: { key: 'default_locale' },
    update: {},
    create: { key: 'default_locale', value: 'en', group: 'general', isPublic: true },
  });
}

export default async function globalSetup(): Promise<void> {
  if (!DATABASE_URL.includes('kast_test')) {
    throw new Error(`Refusing to run e2e against non-test DB: ${DATABASE_URL}`);
  }
  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  try {
    await prisma.$connect();
    await truncateAll(prisma);
    await seedRoles(prisma);
    await seedLocales(prisma);
    await seedAdmin(prisma);
    await seedSettings(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

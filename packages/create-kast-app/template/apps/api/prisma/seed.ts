import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function seedLocales(): Promise<void> {
  await prisma.locale.upsert({
    where: { code: 'en' },
    update: {},
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
    update: {},
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

async function seedAdminUser(): Promise<void> {
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'super_admin' } });
  const passwordHash = await argon2.hash('Admin1234!', { type: argon2.argon2id });
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@kast.local' },
    update: {},
    create: {
      email: 'admin@kast.local',
      passwordHash,
      firstName: 'Kast',
      lastName: 'Admin',
      isActive: true,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: superAdmin.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: superAdmin.id, roleId: superAdminRole.id },
  });
}

async function seedSettings(): Promise<void> {
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

async function main(): Promise<void> {
  await seedLocales();
  await seedRoles();
  await seedAdminUser();
  await seedSettings();
  console.warn('✅ Seed complete');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { execa } from 'execa';
import { detectPmVersion } from './checks.js';
import type { PackageManager, ProjectOptions } from './types.js';
import { wsRun } from './workspace.js';

export interface TemplateContext {
  projectName: string;
  packageManager: PackageManager;
  pmVersion: string;
  installCmd: string;
  apiPort: number;
  includeAdmin: boolean;
  i18n: boolean;
  defaultLocale: string;
  extraLocales: string[];
  storageProvider: string;
  storageIsCloud: boolean;
  includeFrontend: boolean;
  frontendStarter: string;
  includeMeilisearch: boolean;
  pluginMeilisearch: boolean;
  pluginStripe: boolean;
  pluginResend: boolean;
  pluginR2: boolean;
  pluginSentry: boolean;
  deployTarget: string;
  isPnpm: boolean;
  /** pnpm >= 10: build permissions live in pnpm-workspace.yaml, not package.json. */
  isPnpmWorkspaceConfig: boolean;
  /** pnpm >= 11: the workspace file wants an `allowBuilds` map, not a list. */
  isPnpmAllowBuilds: boolean;
  /** pnpm 10 exactly: the workspace file wants `onlyBuiltDependencies`. */
  isPnpmOnlyBuilt: boolean;
  /** pnpm < 10: package.json `pnpm.onlyBuiltDependencies`, workspace file ignored. */
  isPnpmLegacyConfig: boolean;
  isNpm: boolean;
  isYarn: boolean;
  isBun: boolean;
  dbGenerateCmd: string;
  dbMigrateCmd: string;
  dbMigrateProdCmd: string;
  dbSeedCmd: string;
}

/**
 * Where a project declares which dependencies may run build scripts has moved
 * twice, and getting it wrong is silent: pnpm skips the build scripts for
 * argon2, sharp and Prisma, the install looks clean, and the API fails at
 * runtime on missing native bindings.
 *
 *   pnpm  <10  package.json  `pnpm.onlyBuiltDependencies`
 *   pnpm  10   pnpm-workspace.yaml  `onlyBuiltDependencies:` (list)
 *   pnpm >=11  pnpm-workspace.yaml  `allowBuilds:` (map, and an unlisted
 *              package with a build script fails the install outright)
 *
 * `packageManager` pins the exact version a generated project will use, so the
 * scaffolder emits the one form that version reads.
 */
function majorVersion(version: string): number {
  return Number.parseInt(version.split('.')[0] ?? '', 10) || 0;
}

function installCmd(pm: PackageManager): string {
  if (pm === 'yarn') return 'yarn install';
  if (pm === 'bun') return 'bun install';
  if (pm === 'npm') return 'npm install';
  return 'pnpm install';
}

export async function resolvePmVersion(pm: PackageManager): Promise<string> {
  const fromAgent = detectPmVersion(pm);
  if (fromAgent) return fromAgent;
  try {
    const { stdout } = await execa(pm, ['--version']);
    const match = /(\d+\.\d+\.\d+)/.exec(stdout.trim());
    if (match?.[1]) return match[1];
  } catch {
    // ignore
  }
  const fallbacks: Record<PackageManager, string> = {
    pnpm: '9.0.0',
    npm: '10.0.0',
    yarn: '1.22.0',
    bun: '1.0.0',
  };
  return fallbacks[pm];
}

export function buildContext(opts: ProjectOptions, pmVersion: string): TemplateContext {
  return {
    projectName: opts.projectName,
    packageManager: opts.packageManager,
    pmVersion,
    installCmd: installCmd(opts.packageManager),
    apiPort: opts.apiPort,
    includeAdmin: opts.includeAdmin,
    i18n: opts.i18n,
    defaultLocale: opts.defaultLocale,
    extraLocales: opts.extraLocales,
    storageProvider: opts.storageProvider,
    storageIsCloud: opts.storageProvider !== 'local',
    includeFrontend: opts.frontendStarter !== 'none',
    frontendStarter: opts.frontendStarter,
    includeMeilisearch: opts.plugins.includes('meilisearch'),
    pluginMeilisearch: opts.plugins.includes('meilisearch'),
    pluginStripe: opts.plugins.includes('stripe'),
    pluginResend: opts.plugins.includes('resend'),
    pluginR2: opts.plugins.includes('r2'),
    pluginSentry: opts.plugins.includes('sentry'),
    deployTarget: opts.deployTarget,
    isPnpm: opts.packageManager === 'pnpm',
    isPnpmWorkspaceConfig: opts.packageManager === 'pnpm' && majorVersion(pmVersion) >= 10,
    isPnpmAllowBuilds: opts.packageManager === 'pnpm' && majorVersion(pmVersion) >= 11,
    isPnpmOnlyBuilt: opts.packageManager === 'pnpm' && majorVersion(pmVersion) === 10,
    isPnpmLegacyConfig: opts.packageManager === 'pnpm' && majorVersion(pmVersion) < 10,
    isNpm: opts.packageManager === 'npm',
    isYarn: opts.packageManager === 'yarn',
    isBun: opts.packageManager === 'bun',
    // prisma:generate needs no DATABASE_URL; the rest run Prisma from apps/api,
    // so load the repo-root .env via dotenv-cli before delegating.
    dbGenerateCmd: wsRun(opts.packageManager, '@kast-cms/api', 'prisma:generate'),
    dbMigrateCmd: `dotenv -- ${wsRun(opts.packageManager, '@kast-cms/api', 'prisma:migrate')}`,
    dbMigrateProdCmd: `dotenv -- ${wsRun(opts.packageManager, '@kast-cms/api', 'prisma:migrate:prod')}`,
    dbSeedCmd: `dotenv -- ${wsRun(opts.packageManager, '@kast-cms/api', 'prisma:seed')}`,
  };
}

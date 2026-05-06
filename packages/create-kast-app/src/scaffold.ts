import { execa } from 'execa';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'fs/promises';
import Handlebars from 'handlebars';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { detectPmVersion } from './checks.js';
import {
  DOCKER_COMPOSE_TEMPLATE,
  ENV_EXAMPLE_TEMPLATE,
  GITIGNORE_TEMPLATE,
  PACKAGE_JSON_API_ONLY_TEMPLATE,
  PACKAGE_JSON_TEMPLATE,
  RAILWAY_TEMPLATE,
  README_TEMPLATE,
  RENDER_TEMPLATE,
  VERCEL_TEMPLATE,
  WORKSPACE_TEMPLATE,
} from './templates/index.js';
import type { PackageManager, ProjectOptions } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEMPLATE_DIR = join(__dirname, '..', 'template');

interface TemplateContext {
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
  isNpm: boolean;
  isYarn: boolean;
  isBun: boolean;
}

function installCmd(pm: PackageManager): string {
  if (pm === 'yarn') return 'yarn install';
  if (pm === 'bun') return 'bun install';
  if (pm === 'npm') return 'npm install';
  return 'pnpm install';
}

async function resolvePmVersion(pm: PackageManager): Promise<string> {
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

function buildContext(opts: ProjectOptions, pmVersion: string): TemplateContext {
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
    isNpm: opts.packageManager === 'npm',
    isYarn: opts.packageManager === 'yarn',
    isBun: opts.packageManager === 'bun',
  };
}

function render(template: string, ctx: TemplateContext): string {
  return Handlebars.compile(template, { noEscape: true })(ctx);
}

interface FileEntry {
  path: string;
  content: string;
}

function getMonorepoGeneratedFiles(ctx: TemplateContext, opts: ProjectOptions): FileEntry[] {
  const files: FileEntry[] = [
    { path: 'package.json', content: render(PACKAGE_JSON_TEMPLATE, ctx) },
    { path: 'docker-compose.yml', content: render(DOCKER_COMPOSE_TEMPLATE, ctx) },
    { path: '.env.example', content: render(ENV_EXAMPLE_TEMPLATE, ctx) },
    { path: 'README.md', content: render(README_TEMPLATE, ctx) },
    { path: '.gitignore', content: GITIGNORE_TEMPLATE },
  ];

  const workspaceContent = render(WORKSPACE_TEMPLATE, ctx);
  if (opts.packageManager === 'pnpm') {
    files.push({ path: 'pnpm-workspace.yaml', content: workspaceContent });
  }

  if (opts.deployTarget === 'railway') {
    files.push({ path: 'railway.toml', content: render(RAILWAY_TEMPLATE, ctx) });
  } else if (opts.deployTarget === 'render') {
    files.push({ path: 'render.yaml', content: render(RENDER_TEMPLATE, ctx) });
  } else if (opts.deployTarget === 'vercel') {
    files.push({ path: 'vercel.json', content: render(VERCEL_TEMPLATE, ctx) });
  }

  return files;
}

function getApiOnlyGeneratedFiles(ctx: TemplateContext, opts: ProjectOptions): FileEntry[] {
  const files: FileEntry[] = [
    { path: 'package.json', content: render(PACKAGE_JSON_API_ONLY_TEMPLATE, ctx) },
    { path: 'docker-compose.yml', content: render(DOCKER_COMPOSE_TEMPLATE, ctx) },
    { path: '.env.example', content: render(ENV_EXAMPLE_TEMPLATE, ctx) },
    { path: 'README.md', content: render(README_TEMPLATE, ctx) },
    { path: '.gitignore', content: GITIGNORE_TEMPLATE },
  ];

  if (opts.deployTarget === 'railway') {
    files.push({ path: 'railway.toml', content: render(RAILWAY_TEMPLATE, ctx) });
  } else if (opts.deployTarget === 'render') {
    files.push({ path: 'render.yaml', content: render(RENDER_TEMPLATE, ctx) });
  }

  return files;
}

async function runInstall(pm: PackageManager, cwd: string): Promise<void> {
  const [bin, ...args] =
    pm === 'npm'
      ? ['npm', 'install']
      : pm === 'yarn'
        ? ['yarn', 'install']
        : pm === 'bun'
          ? ['bun', 'install']
          : ['pnpm', 'install'];
  await execa(bin, args, { cwd, stdio: 'inherit' });
}

async function scaffoldMonorepo(
  opts: ProjectOptions,
  targetDir: string,
  ctx: TemplateContext,
  scaffoldOpts: ScaffoldOptions,
): Promise<void> {
  await cp(TEMPLATE_DIR, targetDir, {
    recursive: true,
    filter: (src) => {
      const rel = src.replace(TEMPLATE_DIR, '');
      return (
        !rel.includes('node_modules') &&
        !rel.includes('/.next') &&
        !rel.includes('/dist') &&
        !rel.endsWith('.tsbuildinfo') &&
        !rel.endsWith('.templateignore')
      );
    },
  });

  if (!opts.includeAdmin) {
    await rm(join(targetDir, 'apps', 'admin'), { recursive: true, force: true });
  }

  const files = getMonorepoGeneratedFiles(ctx, opts);
  for (const file of files) {
    await writeFile(join(targetDir, file.path), file.content, 'utf-8');
  }

  const envExample = await readFile(join(targetDir, '.env.example'), 'utf-8');
  await writeFile(join(targetDir, '.env'), envExample, 'utf-8');

  // Fix workspace dependencies for npm
  if (opts.packageManager === 'npm') {
    await fixWorkspaceDependencies(targetDir);
  }

  if (!scaffoldOpts.skipInstall) {
    process.stdout.write(`\n  Installing dependencies with ${ctx.packageManager}...\n`);
    await runInstall(opts.packageManager, targetDir);
  }
}

async function scaffoldApiOnly(
  opts: ProjectOptions,
  targetDir: string,
  ctx: TemplateContext,
  scaffoldOpts: ScaffoldOptions,
): Promise<void> {
  await mkdir(targetDir, { recursive: true });

  const apiTemplateDir = join(TEMPLATE_DIR, 'apps', 'api');
  await cp(apiTemplateDir, targetDir, {
    recursive: true,
    filter: (src) => {
      const rel = src.replace(apiTemplateDir, '');
      return (
        !rel.includes('node_modules') && !rel.includes('/dist') && !rel.endsWith('.tsbuildinfo')
      );
    },
  });

  const files = getApiOnlyGeneratedFiles(ctx, opts);
  for (const file of files) {
    await writeFile(join(targetDir, file.path), file.content, 'utf-8');
  }

  const envExample = await readFile(join(targetDir, '.env.example'), 'utf-8');
  await writeFile(join(targetDir, '.env'), envExample, 'utf-8');

  // Fix workspace dependencies for npm
  if (opts.packageManager === 'npm') {
    await fixWorkspaceDependencies(targetDir);
  }

  if (!scaffoldOpts.skipInstall) {
    process.stdout.write(`\n  Installing dependencies with ${ctx.packageManager}...\n`);
    await runInstall(opts.packageManager, targetDir);
  }
}

async function fixWorkspaceDependencies(targetDir: string): Promise<void> {
  // Find all package.json files in the project
  const packageJsonFiles: string[] = [];

  async function findPackageJsonFiles(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.name === 'package.json' && entry.isFile()) {
        packageJsonFiles.push(fullPath);
      } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await findPackageJsonFiles(fullPath);
      }
    }
  }

  await findPackageJsonFiles(targetDir);

  // Process each package.json file
  for (const filePath of packageJsonFiles) {
    try {
      const content = await readFile(filePath, 'utf-8');
      const pkg: Record<string, any> = JSON.parse(content);
      let modified = false;

      // Fix dependencies
      if (pkg.dependencies) {
        for (const [key, value] of Object.entries(pkg.dependencies)) {
          if (value === 'workspace:*') {
            // Use actual version numbers for npm
            if (key === '@kast-cms/sdk') {
              pkg.dependencies[key as string = '^0.3.2';
            } else if (key === '@kast-cms/plugin-sdk') {
              pkg.dependencies[key as string = '^0.1.0';
            } else {
              // Default fallback for other workspace dependencies
              pkg.dependencies[key as string = '*';
            }
            modified = true;
          }
        }
      }

      if (modified) {
        await writeFile(filePath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      }
    } catch (error) {
      // Silently skip files that can't be processed
      console.warn(`Warning: Could not process ${filePath}:`, error);
    }
  }
}

export interface ScaffoldOptions {
  skipInstall?: boolean;
}

export async function scaffoldProject(
  opts: ProjectOptions,
  targetDir: string,
  scaffoldOpts: ScaffoldOptions = {},
): Promise<void> {
  const pmVersion = await resolvePmVersion(opts.packageManager);
  const ctx = buildContext(opts, pmVersion);

  if (opts.includeAdmin) {
    await scaffoldMonorepo(opts, targetDir, ctx, scaffoldOpts);
  } else {
    await scaffoldApiOnly(opts, targetDir, ctx, scaffoldOpts);
  }

  try {
    await execa('git', ['init'], { cwd: targetDir });
    await execa('git', ['add', '-A'], { cwd: targetDir });
    await execa('git', ['commit', '-m', 'chore: initial scaffold via create-kast-app'], {
      cwd: targetDir,
    });
  } catch {
    // Git might not be installed — silently skip
  }
}

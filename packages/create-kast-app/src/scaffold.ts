import { execa } from 'execa';
import { cp, readFile, writeFile } from 'fs/promises';
import Handlebars from 'handlebars';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { detectPmVersion } from './checks.js';
import {
  DOCKER_COMPOSE_TEMPLATE,
  ENV_EXAMPLE_TEMPLATE,
  GITIGNORE_TEMPLATE,
  PACKAGE_JSON_TEMPLATE,
  RAILWAY_TEMPLATE,
  README_TEMPLATE,
  RENDER_TEMPLATE,
  VERCEL_TEMPLATE,
  WORKSPACE_TEMPLATE,
} from './templates/index.js';
import type { PackageManager, ProjectOptions } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve template directory relative to the compiled dist/ output.
// In the published package: dist/index.js → ../template
const TEMPLATE_DIR = join(__dirname, '..', 'template');

// ── Context ────────────────────────────────────────────────────────────────────

interface TemplateContext {
  projectName: string;
  packageManager: PackageManager;
  pmVersion: string;
  installCmd: string;
  apiPort: number;
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
  // 1. Try to parse from npm_config_user_agent (set by all major PMs)
  const fromAgent = detectPmVersion(pm);
  if (fromAgent) return fromAgent;
  // 2. Fall back to running `<pm> --version`
  try {
    const { stdout } = await execa(pm, ['--version']);
    const match = /(\d+\.\d+\.\d+)/.exec(stdout.trim());
    if (match?.[1]) return match[1];
  } catch {
    // ignore
  }
  // 3. Last-resort known stable versions
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

// ── Generated files (Handlebars) ───────────────────────────────────────────────

interface FileEntry {
  path: string;
  content: string;
}

function getGeneratedFiles(ctx: TemplateContext, opts: ProjectOptions): FileEntry[] {
  const files: FileEntry[] = [
    { path: 'package.json', content: render(PACKAGE_JSON_TEMPLATE, ctx) },
    { path: 'docker-compose.yml', content: render(DOCKER_COMPOSE_TEMPLATE, ctx) },
    { path: '.env.example', content: render(ENV_EXAMPLE_TEMPLATE, ctx) },
    { path: 'README.md', content: render(README_TEMPLATE, ctx) },
    { path: '.gitignore', content: GITIGNORE_TEMPLATE },
  ];

  // Workspace file — format depends on chosen package manager
  const workspaceContent = render(WORKSPACE_TEMPLATE, ctx);
  if (opts.packageManager === 'pnpm') {
    files.push({ path: 'pnpm-workspace.yaml', content: workspaceContent });
  }
  // npm/yarn/bun use "workspaces" inside package.json (handled in PACKAGE_JSON_TEMPLATE)

  if (opts.deployTarget === 'railway') {
    files.push({ path: 'railway.toml', content: render(RAILWAY_TEMPLATE, ctx) });
  } else if (opts.deployTarget === 'render') {
    files.push({ path: 'render.yaml', content: render(RENDER_TEMPLATE, ctx) });
  } else if (opts.deployTarget === 'vercel') {
    files.push({ path: 'vercel.json', content: render(VERCEL_TEMPLATE, ctx) });
  }

  return files;
}

// ── Run package manager install ────────────────────────────────────────────────

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

// ── Main export ────────────────────────────────────────────────────────────────

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

  // 1. Copy static source template tree into target directory
  await cp(TEMPLATE_DIR, targetDir, {
    recursive: true,
    // Skip .templateignore and the ignore file itself
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

  // 2. Write all Handlebars-generated files on top (overwrite placeholders)
  const files = getGeneratedFiles(ctx, opts);
  for (const file of files) {
    await writeFile(join(targetDir, file.path), file.content, 'utf-8');
  }

  // 3. Copy .env.example → .env so the project works immediately
  const envExample = await readFile(join(targetDir, '.env.example'), 'utf-8');
  await writeFile(join(targetDir, '.env'), envExample, 'utf-8');

  // 4. Install dependencies (unless skipped, e.g. in CI/test runs)
  if (!scaffoldOpts.skipInstall) {
    process.stdout.write(`\n  Installing dependencies with ${ctx.packageManager}...\n`);
    await runInstall(opts.packageManager, targetDir);
  }

  // 5. Initialise git repository
  try {
    await execa('git', ['init'], { cwd: targetDir });
    await execa('git', ['add', '-A'], { cwd: targetDir });
    await execa('git', ['commit', '-m', 'chore: initial scaffold via create-kast-app'], {
      cwd: targetDir,
    });
  } catch {
    // Git might not be installed — silently skip, project is still valid
  }
}

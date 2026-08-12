import { randomBytes } from 'crypto';
import { execa } from 'execa';
import { cp, mkdir, readFile, rm, writeFile } from 'fs/promises';
import Handlebars from 'handlebars';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { buildContext, resolvePmVersion, type TemplateContext } from './template-context.js';
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
import type { FrontendStarter, PackageManager, ProjectOptions } from './types.js';
import { internalDepSpec, rewriteWorkspaceProtocol } from './workspace.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEMPLATE_DIR = join(__dirname, '..', 'template');
const FIRST_PARTY_PLUGINS: Record<string, string> = {
  meilisearch: 'kast-plugin-meilisearch',
  stripe: 'kast-plugin-stripe',
  resend: 'kast-plugin-resend',
  r2: 'kast-plugin-r2',
  sentry: 'kast-plugin-sentry',
};

/**
 * Writes the runtime `.env` from `.env.example`, swapping every placeholder
 * secret for a freshly generated one. The placeholders are long enough to
 * satisfy the API's min-32-character checks, so copying them verbatim would
 * leave every scaffolded project signing tokens and encrypting stored secrets
 * with the same publicly known keys without anything ever failing to prompt the
 * user.
 */
async function writeEnvFile(targetDir: string): Promise<void> {
  const envExample = await readFile(join(targetDir, '.env.example'), 'utf-8');
  const postgresPassword = randomBytes(32).toString('base64url');
  const env = envExample
    .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${randomBytes(48).toString('base64url')}`)
    .replace(/^REDIS_PASSWORD=.*$/m, `REDIS_PASSWORD=${randomBytes(32).toString('base64url')}`)
    .replace(/^POSTGRES_PASSWORD=.*$/m, `POSTGRES_PASSWORD=${postgresPassword}`)
    .replace(
      /^DATABASE_URL=postgresql:\/\/kast:[^@]*@/m,
      `DATABASE_URL=postgresql://kast:${postgresPassword}@`,
    )
    .replace(
      /^MEILISEARCH_MASTER_KEY=.*$/m,
      `MEILISEARCH_MASTER_KEY=${randomBytes(32).toString('base64url')}`,
    )
    .replace(
      /^KAST_SECRET_ENCRYPTION_KEY=.*$/m,
      `KAST_SECRET_ENCRYPTION_KEY=${randomBytes(48).toString('base64url')}`,
    );
  await writeFile(join(targetDir, '.env'), env, 'utf-8');
}

function render(template: string, ctx: TemplateContext): string {
  return Handlebars.compile(template, { noEscape: true })(ctx);
}

interface FileEntry {
  path: string;
  content: string;
}

/**
 * Package-manager-specific config files. The NestJS ecosystem still declares
 * Nest 10 peer ranges, which only npm enforces strictly — install leniently
 * like pnpm/yarn/bun. Yarn Berry defaults to PnP, which breaks Prisma and
 * native modules, so pin it to the node_modules linker.
 */
function getPmConfigFiles(opts: ProjectOptions): FileEntry[] {
  if (opts.packageManager === 'npm') {
    return [{ path: '.npmrc', content: 'legacy-peer-deps=true\n' }];
  }
  if (opts.packageManager === 'yarn') {
    return [{ path: '.yarnrc.yml', content: 'nodeLinker: node-modules\n' }];
  }
  return [];
}

async function keepSelectedPlugins(targetDir: string, selected: string[]): Promise<void> {
  const selectedDirs = new Set(selected.map((name) => FIRST_PARTY_PLUGINS[name]).filter(Boolean));
  for (const dir of Object.values(FIRST_PARTY_PLUGINS)) {
    if (!selectedDirs.has(dir)) {
      await rm(join(targetDir, 'plugins', dir), { recursive: true, force: true });
    }
  }
  await rm(join(targetDir, 'plugins', '.gitkeep'), { force: true });
}

async function addFrontendStarter(targetDir: string, starter: FrontendStarter): Promise<void> {
  if (starter === 'none') return;
  await cp(join(TEMPLATE_DIR, 'starters', starter), join(targetDir, 'apps', 'web'), {
    recursive: true,
  });
}

function getMonorepoGeneratedFiles(ctx: TemplateContext, opts: ProjectOptions): FileEntry[] {
  const files: FileEntry[] = [
    { path: 'package.json', content: render(PACKAGE_JSON_TEMPLATE, ctx) },
    { path: 'docker-compose.yml', content: render(DOCKER_COMPOSE_TEMPLATE, ctx) },
    { path: '.env.example', content: render(ENV_EXAMPLE_TEMPLATE, ctx) },
    { path: 'README.md', content: render(README_TEMPLATE, ctx) },
    { path: '.gitignore', content: GITIGNORE_TEMPLATE },
    ...getPmConfigFiles(opts),
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
    ...getPmConfigFiles(opts),
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
        !rel.startsWith('/starters') &&
        !rel.endsWith('.tsbuildinfo') &&
        !rel.endsWith('.templateignore')
      );
    },
  });

  if (!opts.includeAdmin) {
    await rm(join(targetDir, 'apps', 'admin'), { recursive: true, force: true });
  }
  await keepSelectedPlugins(targetDir, opts.plugins);
  await addFrontendStarter(targetDir, opts.frontendStarter);

  // npm and Yarn Classic can't resolve the `workspace:` protocol — rewrite it.
  const depSpec = internalDepSpec(opts.packageManager, ctx.pmVersion);
  if (depSpec !== 'workspace:*') {
    await rewriteWorkspaceProtocol(targetDir, depSpec);
  }

  const files = getMonorepoGeneratedFiles(ctx, opts);
  for (const file of files) {
    await writeFile(join(targetDir, file.path), file.content, 'utf-8');
  }

  await writeEnvFile(targetDir);

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

  await mkdir(join(targetDir, 'plugins'), { recursive: true });
  for (const selected of opts.plugins) {
    const dir = FIRST_PARTY_PLUGINS[selected];
    if (dir)
      await cp(join(TEMPLATE_DIR, 'plugins', dir), join(targetDir, 'plugins', dir), {
        recursive: true,
      });
  }
  await cp(join(TEMPLATE_DIR, 'tsconfig.base.json'), join(targetDir, 'tsconfig.base.json'));

  const files = getApiOnlyGeneratedFiles(ctx, opts);
  for (const file of files) {
    await writeFile(join(targetDir, file.path), file.content, 'utf-8');
  }

  await writeEnvFile(targetDir);

  if (!scaffoldOpts.skipInstall) {
    process.stdout.write(`\n  Installing dependencies with ${ctx.packageManager}...\n`);
    await runInstall(opts.packageManager, targetDir);
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

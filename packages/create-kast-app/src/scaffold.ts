import { execa } from 'execa';
import { mkdir, writeFile } from 'fs/promises';
import Handlebars from 'handlebars';
import { join } from 'path';
import {
  DOCKER_COMPOSE_TEMPLATE,
  ENV_EXAMPLE_TEMPLATE,
  GITIGNORE_TEMPLATE,
  PACKAGE_JSON_TEMPLATE,
  PNPM_WORKSPACE_TEMPLATE,
  RAILWAY_TEMPLATE,
  README_TEMPLATE,
  RENDER_TEMPLATE,
  VERCEL_TEMPLATE,
} from './templates/index.js';
import type { ProjectOptions } from './types.js';

interface TemplateContext {
  projectName: string;
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
}

function buildContext(opts: ProjectOptions): TemplateContext {
  return {
    projectName: opts.projectName,
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
  };
}

function render(template: string, ctx: TemplateContext): string {
  return Handlebars.compile(template, { noEscape: true })(ctx);
}

interface FileEntry {
  path: string;
  content: string;
}

function getFiles(ctx: TemplateContext, opts: ProjectOptions): FileEntry[] {
  const files: FileEntry[] = [
    { path: 'package.json', content: render(PACKAGE_JSON_TEMPLATE, ctx) },
    { path: 'pnpm-workspace.yaml', content: render(PNPM_WORKSPACE_TEMPLATE, ctx) },
    { path: 'docker-compose.yml', content: render(DOCKER_COMPOSE_TEMPLATE, ctx) },
    { path: '.env.example', content: render(ENV_EXAMPLE_TEMPLATE, ctx) },
    { path: 'README.md', content: render(README_TEMPLATE, ctx) },
    { path: '.gitignore', content: GITIGNORE_TEMPLATE },
  ];

  if (opts.deployTarget === 'railway') {
    files.push({ path: 'railway.toml', content: render(RAILWAY_TEMPLATE, ctx) });
  } else if (opts.deployTarget === 'render') {
    files.push({ path: 'render.yaml', content: render(RENDER_TEMPLATE, ctx) });
  } else if (opts.deployTarget === 'vercel') {
    files.push({ path: 'vercel.json', content: render(VERCEL_TEMPLATE, ctx) });
  }

  return files;
}

export async function scaffoldProject(opts: ProjectOptions, targetDir: string): Promise<void> {
  const ctx = buildContext(opts);

  // Create directory skeleton
  const dirs = [
    targetDir,
    join(targetDir, 'apps'),
    join(targetDir, 'packages'),
    join(targetDir, 'plugins'),
  ];
  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }

  // Write all generated files
  const files = getFiles(ctx, opts);
  for (const file of files) {
    await writeFile(join(targetDir, file.path), file.content, 'utf-8');
  }

  // Copy .env.example → .env so docker-compose up works immediately after setup
  const envExample = await import('fs/promises').then((m) =>
    m.readFile(join(targetDir, '.env.example'), 'utf-8'),
  );
  await writeFile(join(targetDir, '.env'), envExample, 'utf-8');

  // Initialise git repository
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

import { cancel, confirm, intro, isCancel, multiselect, outro, select, text } from '@clack/prompts';
import pc from 'picocolors';
import { isPortAvailable } from './checks.js';
import type { DeployTarget, FrontendStarter, ProjectOptions, StorageProvider } from './types.js';

const BANNER = `
  ██╗  ██╗ █████╗ ███████╗████████╗
  ██║ ██╔╝██╔══██╗██╔════╝╚══██╔══╝
  █████╔╝ ███████║███████╗   ██║
  ██╔═██╗ ██╔══██║╚════██║   ██║
  ██║  ██╗██║  ██║███████║   ██║
  ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝
  Cast Your Content Everywhere — v1.0.0
`;

function abortIfCancelled<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel('Installation cancelled.');
    process.exit(0);
  }
  return value;
}

export function getDefaultOptions(projectName: string): ProjectOptions {
  return {
    projectName,
    apiPort: 3000,
    i18n: false,
    defaultLocale: 'en',
    extraLocales: [],
    storageProvider: 'local',
    plugins: [],
    frontendStarter: 'none',
    deployTarget: 'none',
  };
}

async function promptProjectName(initial?: string): Promise<string> {
  if (initial) return initial;
  return abortIfCancelled(
    await text({
      message: 'Project name:',
      placeholder: 'my-kast-app',
      validate(value) {
        if (!value.trim()) return 'Project name is required';
        if (!/^[a-z0-9-]+$/.test(value)) return 'Use lowercase letters, numbers, and hyphens only';
      },
    }),
  );
}

async function promptApiPort(): Promise<number> {
  const portStr = abortIfCancelled(
    await text({
      message: 'API port:',
      placeholder: '3000',
      initialValue: '3000',
      validate(value) {
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 1 || n > 65535) return 'Enter a valid port (1–65535)';
      },
    }),
  );
  let port = parseInt(portStr, 10);
  if (!(await isPortAvailable(port))) {
    let alt = port + 1;
    while (!(await isPortAvailable(alt)) && alt < 65535) alt++;
    const altStr = abortIfCancelled(
      await text({
        message: `Port ${port} is in use. Try:`,
        initialValue: String(alt),
        validate(value) {
          const n = parseInt(value, 10);
          if (isNaN(n) || n < 1 || n > 65535) return 'Enter a valid port (1–65535)';
        },
      }),
    );
    port = parseInt(altStr, 10);
  }
  return port;
}

async function promptI18n(): Promise<{ i18n: boolean; extraLocales: string[] }> {
  const i18n = abortIfCancelled(await confirm({ message: 'Enable multiple languages (i18n)?' }));
  if (!i18n) return { i18n: false, extraLocales: [] };
  const extraLocales = abortIfCancelled(
    await multiselect({
      message: 'Additional languages (space to select):',
      options: [
        { value: 'ar', label: 'Arabic (ar)' },
        { value: 'fr', label: 'French (fr)' },
        { value: 'de', label: 'German (de)' },
        { value: 'es', label: 'Spanish (es)' },
        { value: 'pt', label: 'Portuguese (pt)' },
        { value: 'zh', label: 'Chinese (zh)' },
        { value: 'ja', label: 'Japanese (ja)' },
      ],
      required: false,
    }),
  ) as string[];
  return { i18n: true, extraLocales };
}

async function promptStorageAndPlugins(): Promise<{
  storageProvider: StorageProvider;
  plugins: string[];
}> {
  const storageProvider = abortIfCancelled(
    await select({
      message: 'Storage provider:',
      options: [
        { value: 'local', label: 'Local filesystem', hint: 'recommended for dev' },
        { value: 'r2', label: 'Cloudflare R2', hint: 'production-ready' },
        { value: 's3', label: 'Amazon S3' },
        { value: 'minio', label: 'MinIO', hint: 'self-hosted S3' },
      ],
    }),
  ) as StorageProvider;
  const plugins = abortIfCancelled(
    await multiselect({
      message: 'Install plugins (space to select):',
      options: [
        { value: 'meilisearch', label: '@kast/plugin-meilisearch', hint: 'full-text search' },
        { value: 'stripe', label: '@kast/plugin-stripe', hint: 'commerce' },
        { value: 'resend', label: '@kast/plugin-resend', hint: 'email' },
        { value: 'r2', label: '@kast/plugin-r2', hint: 'Cloudflare R2 storage' },
        { value: 'sentry', label: '@kast/plugin-sentry', hint: 'error tracking' },
      ],
      required: false,
    }),
  ) as string[];
  return { storageProvider, plugins };
}

async function promptDeployment(): Promise<{
  frontendStarter: FrontendStarter;
  deployTarget: DeployTarget;
}> {
  const frontendStarter = abortIfCancelled(
    await select({
      message: 'Include frontend starter?',
      options: [
        { value: 'none', label: 'None' },
        { value: 'blog', label: 'Blog template', hint: 'Next.js + @kast-cms/sdk + ISR' },
        { value: 'docs', label: 'Docs template', hint: 'Next.js + @kast-cms/sdk + MDX' },
      ],
    }),
  ) as FrontendStarter;
  const deployTarget = abortIfCancelled(
    await select({
      message: 'Generate deploy config?',
      options: [
        { value: 'none', label: 'Skip' },
        { value: 'railway', label: 'Railway' },
        { value: 'render', label: 'Render' },
        { value: 'vercel', label: 'Vercel' },
      ],
    }),
  ) as DeployTarget;
  return { frontendStarter, deployTarget };
}

export async function runInteractivePrompts(initialName?: string): Promise<ProjectOptions> {
  process.stdout.write(pc.cyan(BANNER) + '\n');
  intro(pc.bgCyan(pc.black(' create-kast-app ')));

  const projectName = await promptProjectName(initialName);
  const apiPort = await promptApiPort();
  const { i18n, extraLocales } = await promptI18n();
  const { storageProvider, plugins } = await promptStorageAndPlugins();
  const { frontendStarter, deployTarget } = await promptDeployment();

  outro(pc.green('✓ Configuration complete'));

  return {
    projectName,
    apiPort,
    i18n,
    defaultLocale: 'en',
    extraLocales,
    storageProvider,
    plugins,
    frontendStarter,
    deployTarget,
  };
}

import { existsSync } from 'fs';
import { resolve } from 'path';
import pc from 'picocolors';
import { checkNodeVersion } from './checks.js';
import { getDefaultOptions, runInteractivePrompts } from './prompts.js';
import { scaffoldProject } from './scaffold.js';
import type { ProjectOptions } from './types.js';

checkNodeVersion();

function resolveOptions(args: string[]): ProjectOptions | null {
  const skipInteractive = args.includes('--skip-interactive');
  const projectNameArg = args.find((a) => !a.startsWith('-'));

  if (skipInteractive && !projectNameArg) {
    process.stderr.write('✖ Project name is required with --skip-interactive\n');
    process.stderr.write('  Usage: create-kast-app <project-name> --skip-interactive\n');
    process.exit(1);
  }

  if (skipInteractive) {
    process.stdout.write(
      pc.cyan('\n  Creating ') +
        pc.bold(projectNameArg as string) +
        pc.cyan(' with default settings...\n\n'),
    );
    return getDefaultOptions(projectNameArg as string);
  }

  return null; // run interactive prompts
}

function printSuccess(opts: ProjectOptions): void {
  const pm = opts.packageManager;
  const apiUrl = `http://localhost:${opts.apiPort}/api/v1`;
  process.stdout.write(
    [
      '',
      `${pc.green('✓ Done!')} Project created in ${pc.bold(`./${opts.projectName}`)}`,
      '',
      `  ${pc.bold('Next steps:')}`,
      `  ${pc.dim('$')} cd ${opts.projectName}`,
      `  ${pc.dim('$')} ${pc.cyan('cp .env.example .env')}  ${pc.dim('# Set JWT_SECRET at minimum')}`,
      `  ${pc.dim('$')} ${pc.cyan(`${pm} run db:migrate`)}`,
      `  ${pc.dim('$')} ${pc.cyan(`${pm} run dev`)}`,
      '',
      `  Admin:  ${pc.underline('http://localhost:3001/admin')}`,
      `  API:    ${pc.underline(apiUrl)}`,
      `  MCP:    ${pc.underline(`http://localhost:${opts.apiPort}/mcp`)}`,
      '',
      `  ${pc.dim('Tip: docker-compose.yml is available for production deployments.')}`,
      `  Documentation: ${pc.underline('https://docs.kast.dev')}`,
      '',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const projectNameArg = args.find((a) => !a.startsWith('-'));
  const skipInstall = args.includes('--skip-install');

  const options = resolveOptions(args) ?? (await runInteractivePrompts(projectNameArg));
  const targetDir = resolve(process.cwd(), options.projectName);

  if (existsSync(targetDir)) {
    process.stderr.write(
      `\n✖ Directory ${pc.bold(options.projectName)} already exists.\n` +
        `  Choose a different project name or remove the existing directory.\n\n`,
    );
    process.exit(1);
  }

  process.stdout.write(`\n  ${pc.dim('◇')} Scaffolding project files...\n`);
  await scaffoldProject(options, targetDir, { skipInstall });
  printSuccess(options);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`\n${pc.red('✖ Error:')} ${message}\n\n`);
  process.exit(1);
});

import { createServer } from 'net';
import type { PackageManager } from './types.js';

const MIN_NODE_VERSION = 20;

export function checkNodeVersion(): void {
  const [majorStr] = process.versions.node.split('.');
  const major = parseInt(majorStr ?? '0', 10);
  if (major < MIN_NODE_VERSION) {
    process.stderr.write(
      `✖ Kast requires Node.js >= ${MIN_NODE_VERSION}. You have ${process.versions.node}.\n` +
        `  Upgrade: https://nodejs.org/en/download/\n`,
    );
    process.exit(1);
  }
}

export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close(() => {
        resolve(true);
      });
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Detect which package manager was used to invoke the CLI by reading the
 * npm_config_user_agent env var that npm/yarn/pnpm/bun all set at runtime.
 * Falls back to 'pnpm' when undetectable.
 */
export function detectPackageManager(): PackageManager {
  const agent = process.env['npm_config_user_agent'] ?? '';
  if (agent.startsWith('pnpm')) return 'pnpm';
  if (agent.startsWith('yarn')) return 'yarn';
  if (agent.startsWith('bun')) return 'bun';
  if (agent.startsWith('npm')) return 'npm';
  return 'pnpm';
}

/**
 * Extract the version of the invoking package manager from npm_config_user_agent.
 * e.g. "pnpm/9.14.2 npm/? node/v20.18.1 ..." → "9.14.2"
 * Returns null if the version cannot be parsed.
 */
export function detectPmVersion(pm: PackageManager): string | null {
  const agent = process.env['npm_config_user_agent'] ?? '';
  const match = new RegExp(`${pm}\\/(\\d+\\.\\d+\\.\\d+)`).exec(agent);
  return match?.[1] ?? null;
}

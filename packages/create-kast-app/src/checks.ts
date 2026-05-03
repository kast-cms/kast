import { execa } from 'execa';
import { createServer, Socket } from 'net';
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

export function detectPackageManager(): PackageManager {
  const agent = process.env['npm_config_user_agent'] ?? '';
  if (agent.startsWith('pnpm')) return 'pnpm';
  if (agent.startsWith('yarn')) return 'yarn';
  if (agent.startsWith('bun')) return 'bun';
  if (agent.startsWith('npm')) return 'npm';
  return 'pnpm';
}

export function detectPmVersion(pm: PackageManager): string | null {
  const agent = process.env['npm_config_user_agent'] ?? '';
  const match = new RegExp(`${pm}\\/(\\d+\\.\\d+\\.\\d+)`).exec(agent);
  return match?.[1] ?? null;
}

function checkTcpPort(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const client = new Socket();
    const timer = setTimeout(() => {
      client.destroy();
      resolve(false);
    }, timeoutMs);
    client.setTimeout(timeoutMs);
    client.once('connect', () => {
      clearTimeout(timer);
      client.destroy();
      resolve(true);
    });
    client.once('error', () => {
      clearTimeout(timer);
      client.destroy();
      resolve(false);
    });
    client.once('timeout', () => {
      clearTimeout(timer);
      client.destroy();
      resolve(false);
    });
    client.connect(port, host);
  });
}

export async function isDockerAvailable(): Promise<boolean> {
  try {
    await execa('docker', ['--version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function isPostgresReachable(databaseUrl: string): Promise<boolean> {
  try {
    const url = new URL(databaseUrl);
    const host = url.hostname || 'localhost';
    const port = parseInt(url.port, 10) || 5432;
    return checkTcpPort(host, port);
  } catch {
    return false;
  }
}

import { createServer } from 'net';

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

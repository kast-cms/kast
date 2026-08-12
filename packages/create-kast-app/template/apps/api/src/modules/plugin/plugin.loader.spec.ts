import { EventEmitter2 } from '@nestjs/event-emitter';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PluginExtensionRegistry } from './plugin-extension.registry';
import { PluginLoaderService } from './plugin.loader';
import type { PluginRepository } from './plugin.repository';

const record = {
  id: 'plugin-id',
  name: 'fixture-plugin',
  displayName: 'Fixture',
  version: '1.0.0',
  description: null,
  isActive: true,
  isInstalled: true,
  isSystemPlugin: false,
  permissions: ['content:read'],
  hooks: ['content.created'],
  adminPages: [],
  env: [],
  installedAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

function fixtureCatalogue(): string {
  const root = mkdtempSync(join(tmpdir(), 'kast-plugin-loader-'));
  const plugin = join(root, 'fixture');
  mkdirSync(join(plugin, 'dist'), { recursive: true });
  writeFileSync(
    join(plugin, 'kast-plugin.json'),
    JSON.stringify({
      name: 'fixture-plugin',
      version: '1.0.0',
      displayName: 'Fixture',
      permissions: ['content:read'],
      hooks: ['content.created'],
      adminPages: [],
      env: [],
    }),
  );
  writeFileSync(
    join(plugin, 'dist', 'index.js'),
    `module.exports.default = class FixturePlugin {
      async onLoad(ctx) {
        ctx.on('content.created', () => undefined);
        ctx.registerErrorReporter({ provider: 'fixture', captureException: () => undefined });
      }
      async onUnload() { return undefined; }
    };`,
  );
  return root;
}

function repository(overrides: Partial<PluginRepository> = {}): jest.Mocked<PluginRepository> {
  return {
    upsertFromManifest: jest.fn().mockResolvedValue(record),
    findByName: jest.fn().mockResolvedValue(record),
    setActive: jest
      .fn()
      .mockImplementation((_name, active) => Promise.resolve({ ...record, isActive: active })),
    markInstalled: jest
      .fn()
      .mockImplementation((_name, installed) =>
        Promise.resolve({ ...record, isInstalled: installed, isActive: false }),
      ),
    getConfig: jest.fn().mockResolvedValue({}),
    setConfig: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as jest.Mocked<PluginRepository>;
}

describe('PluginLoaderService lifecycle', () => {
  let root: string;
  let previousRoot: string | undefined;

  beforeEach(() => {
    previousRoot = process.env['PLUGINS_ROOT'];
    root = fixtureCatalogue();
    process.env['PLUGINS_ROOT'] = root;
  });

  afterEach(() => {
    if (previousRoot === undefined) delete process.env['PLUGINS_ROOT'];
    else process.env['PLUGINS_ROOT'] = previousRoot;
    rmSync(root, { recursive: true, force: true });
  });

  it('activates and deactivates a plugin without restarting, removing its listeners', async () => {
    const emitter = new EventEmitter2();
    const repo = repository();
    const extensions = new PluginExtensionRegistry();
    const loader = new PluginLoaderService(emitter, repo, extensions);

    await loader.enable('fixture-plugin');
    expect(loader.getLoadedManifests().has('fixture-plugin')).toBe(true);
    expect(emitter.listenerCount('content.created')).toBe(1);

    await loader.disable('fixture-plugin');
    expect(loader.getLoadedManifests().has('fixture-plugin')).toBe(false);
    expect(emitter.listenerCount('content.created')).toBe(0);
    expect(repo.setActive).toHaveBeenLastCalledWith('fixture-plugin', false);
  });

  it('does not resurrect an explicitly uninstalled plugin during bootstrap', async () => {
    const emitter = new EventEmitter2();
    const repo = repository({
      upsertFromManifest: jest.fn().mockResolvedValue({
        ...record,
        isInstalled: false,
        isActive: false,
      }),
    });
    const loader = new PluginLoaderService(emitter, repo, new PluginExtensionRegistry());

    await loader.onApplicationBootstrap();

    expect(loader.getLoadedManifests().size).toBe(0);
    expect(emitter.listenerCount('content.created')).toBe(0);
    expect(repo.setActive).not.toHaveBeenCalled();
  });

  it('uninstall immediately unloads the plugin and persists a tombstone', async () => {
    const emitter = new EventEmitter2();
    const repo = repository();
    const loader = new PluginLoaderService(emitter, repo, new PluginExtensionRegistry());
    await loader.enable('fixture-plugin');

    const result = await loader.uninstall('fixture-plugin');

    expect(result.isInstalled).toBe(false);
    expect(emitter.listenerCount('content.created')).toBe(0);
    expect(repo.markInstalled).toHaveBeenCalledWith('fixture-plugin', false);
  });
});

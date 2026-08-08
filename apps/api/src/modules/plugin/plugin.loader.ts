import {
  PluginHook,
  pluginManifestSchema,
  type IKastPlugin,
  type KastPluginContext,
  type PluginManifest,
} from '@kast-cms/plugin-sdk';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { PluginRepository } from './plugin.repository';

// Resolved at load time — works both in ts-node (src/) and compiled (dist/)
const PLUGINS_ROOT = path.resolve(__dirname, '../../../../../plugins');

const ALLOWED_PERMISSIONS = new Set([
  'content:read',
  'content:write',
  'settings:read',
  'media:read',
  'media:write',
]);

interface PluginModule {
  default?: new () => IKastPlugin;
  Plugin?: new () => IKastPlugin;
}

@Injectable()
export class PluginLoaderService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PluginLoaderService.name);
  private readonly loaded = new Map<string, PluginManifest>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly repo: PluginRepository,
  ) {}

  /** Returns the manifests of all successfully loaded plugins. */
  getLoadedManifests(): ReadonlyMap<string, PluginManifest> {
    return this.loaded;
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!fs.existsSync(PLUGINS_ROOT)) return;
    const entries = fs.readdirSync(PLUGINS_ROOT, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      await this.loadPlugin(path.join(PLUGINS_ROOT, entry.name));
    }
  }

  private async loadPlugin(dir: string): Promise<void> {
    const manifest = this.readManifest(dir);
    if (!manifest) return;
    this.enforcePermissions(manifest);
    const instance = await this.resolveInstance(dir, manifest.name);
    if (!instance) return;
    await this.repo.upsertFromManifest({
      name: manifest.name,
      displayName: manifest.displayName,
      version: manifest.version,
      ...(manifest.description !== undefined ? { description: manifest.description } : {}),
    });
    await instance.onLoad(this.buildContext(manifest.name));
    this.loaded.set(manifest.name, manifest);
    this.logger.log(`Plugin "${manifest.name}" v${manifest.version} loaded`);
  }

  private readManifest(dir: string): PluginManifest | null {
    const manifestPath = path.join(dir, 'kast-plugin.json');
    if (!fs.existsSync(manifestPath)) return null;
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as unknown;
    } catch {
      this.logger.error(`Cannot parse manifest at ${manifestPath}`);
      return null;
    }
    const result = pluginManifestSchema.safeParse(raw);
    if (!result.success) {
      this.logger.error(`Invalid manifest at ${manifestPath}: ${result.error.message}`);
      return null;
    }
    return result.data;
  }

  private enforcePermissions(manifest: PluginManifest): void {
    const disallowed = manifest.permissions.filter((p) => !ALLOWED_PERMISSIONS.has(p));
    if (disallowed.length > 0) {
      throw new Error(
        `Plugin "${manifest.name}" requests disallowed permissions: ${disallowed.join(', ')}`,
      );
    }
  }

  private async resolveInstance(dir: string, name: string): Promise<IKastPlugin | null> {
    const candidates = [path.join(dir, 'dist', 'index.js'), path.join(dir, 'src', 'index.ts')];
    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) continue;
      const instance = await this.createPluginInstance(candidate, name);
      if (instance) return instance;
    }
    this.logger.warn(`No loadable entry found for plugin "${name}"`);
    return null;
  }

  private async createPluginInstance(filePath: string, name: string): Promise<IKastPlugin | null> {
    const mod =
      this.requirePluginModule(filePath, name) ??
      (filePath.endsWith('.js') && process.env.NODE_ENV !== 'test'
        ? await this.importPluginModule(filePath, name)
        : null);
    if (!mod) return null;
    const Cls = mod.default ?? mod.Plugin;
    if (typeof Cls !== 'function') {
      this.logger.warn(`Plugin "${name}" does not export a default constructor`);
      return null;
    }
    return new Cls();
  }

  private requirePluginModule(filePath: string, name: string): PluginModule | null {
    try {
      return require(filePath) as PluginModule;
    } catch (err) {
      if (isEsmLikeRequireError(err)) return null;
      this.logger.error(`Failed to require plugin "${name}": ${String(err)}`);
      return null;
    }
  }

  private async importPluginModule(filePath: string, name: string): Promise<PluginModule | null> {
    try {
      return (await import(pathToFileURL(filePath).href)) as PluginModule;
    } catch (err) {
      this.logger.error(`Failed to import plugin "${name}": ${String(err)}`);
      return null;
    }
  }

  private buildContext(pluginName: string): KastPluginContext {
    const emitter = this.eventEmitter;
    const repo = this.repo;
    return {
      pluginName,
      on(event: PluginHook, handler: (payload: unknown) => void | Promise<void>): void {
        emitter.on(event as string, (payload: unknown) => {
          void handler(payload);
        });
      },
      getConfig(): Promise<Record<string, unknown>> {
        return repo.getConfig(pluginName);
      },
      setConfig(data: Record<string, unknown>): Promise<void> {
        return repo.setConfig(pluginName, data);
      },
    };
  }
}

function isEsmLikeRequireError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    (typeof err === 'object' && err !== null && 'code' in err && err.code === 'ERR_REQUIRE_ESM') ||
    message.includes('Cannot use import statement outside a module') ||
    message.includes("Unexpected token 'export'")
  );
}

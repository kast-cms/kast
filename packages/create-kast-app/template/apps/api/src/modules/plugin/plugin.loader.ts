import {
  PluginHook,
  pluginManifestSchema,
  type IKastPlugin,
  type KastPluginContext,
  type PluginManifest,
} from '@kast-cms/plugin-sdk';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import type { PluginRecord } from './dto/plugin.dto';
import { PluginExtensionRegistry } from './plugin-extension.registry';
import { PluginRepository } from './plugin.repository';

// In source checkouts and production images the plugin catalogue lives below
// the process working directory. PLUGINS_ROOT supports an explicit read-only
// mount for operators shipping their own trusted plugins.
const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<unknown>;

const ALLOWED_PERMISSIONS = new Set([
  'content:read',
  'content:write',
  'settings:read',
  'settings:write',
  'media:read',
  'media:write',
]);

interface PluginModule {
  default?: new () => IKastPlugin;
  Plugin?: new () => IKastPlugin;
}

interface DiscoveredPlugin {
  dir: string;
  manifest: PluginManifest;
}

@Injectable()
export class PluginLoaderService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PluginLoaderService.name);
  private readonly loaded = new Map<string, PluginManifest>();
  private readonly instances = new Map<string, IKastPlugin>();
  private readonly cleanups = new Map<string, Array<() => void | Promise<void>>>();
  private readonly pluginsRoot = path.resolve(
    process.env['PLUGINS_ROOT'] ?? path.join(process.cwd(), 'plugins'),
  );

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly repo: PluginRepository,
    private readonly extensions: PluginExtensionRegistry,
  ) {}

  getLoadedManifests(): ReadonlyMap<string, PluginManifest> {
    return this.loaded;
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!fs.existsSync(this.pluginsRoot)) {
      this.logger.warn(`Plugin directory not found: ${this.pluginsRoot}`);
      return;
    }
    for (const plugin of this.discoverAll()) {
      try {
        const record = await this.persistManifest(plugin.manifest);
        if (!record.isInstalled) {
          this.logger.log(`Plugin "${plugin.manifest.name}" is uninstalled; skipping`);
          continue;
        }
        if (!record.isActive) {
          this.logger.log(`Plugin "${plugin.manifest.name}" is disabled; skipping`);
          continue;
        }
        await this.activate(plugin);
      } catch (error) {
        this.logger.error(
          `Plugin "${plugin.manifest.name}" was skipped: ${this.errorMessage(error)}`,
        );
      }
    }
  }

  async install(name: string, version: string): Promise<PluginRecord> {
    const plugin = this.discoverByName(name);
    if (plugin.manifest.version !== version) {
      throw new ConflictException(
        `Bundled plugin "${name}" is version ${plugin.manifest.version}, not ${version}`,
      );
    }
    await this.persistManifest(plugin.manifest);
    return this.repo.markInstalled(name, true);
  }

  async enable(name: string): Promise<PluginRecord> {
    const existing = await this.repo.findByName(name);
    if (!existing?.isInstalled) throw new NotFoundException(`Plugin "${name}" is not installed`);
    if (this.loaded.has(name)) return this.repo.setActive(name, true);

    const plugin = this.discoverByName(name);
    await this.repo.setActive(name, true);
    try {
      await this.activate(plugin);
    } catch (error) {
      await this.repo.setActive(name, false);
      throw error;
    }
    return this.repo.setActive(name, true);
  }

  async disable(name: string): Promise<PluginRecord> {
    await this.deactivate(name);
    return this.repo.setActive(name, false);
  }

  async uninstall(name: string): Promise<PluginRecord> {
    await this.deactivate(name);
    return this.repo.markInstalled(name, false);
  }

  private discoverAll(): DiscoveredPlugin[] {
    const discovered: DiscoveredPlugin[] = [];
    const seen = new Set<string>();
    for (const entry of fs.readdirSync(this.pluginsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(this.pluginsRoot, entry.name);
      try {
        const manifest = this.readManifest(dir);
        if (!manifest) continue;
        if (seen.has(manifest.name)) {
          throw new Error(`duplicate plugin name "${manifest.name}"`);
        }
        seen.add(manifest.name);
        discovered.push({ dir, manifest });
      } catch (error) {
        this.logger.error(
          `Plugin directory "${entry.name}" was skipped: ${this.errorMessage(error)}`,
        );
      }
    }
    return discovered;
  }

  private discoverByName(name: string): DiscoveredPlugin {
    const found = this.discoverAll().find((plugin) => plugin.manifest.name === name);
    if (!found) {
      throw new NotFoundException(
        `Plugin "${name}" is not present in the trusted catalogue at ${this.pluginsRoot}`,
      );
    }
    return found;
  }

  private async persistManifest(manifest: PluginManifest): Promise<PluginRecord> {
    this.enforcePermissions(manifest);
    return this.repo.upsertFromManifest({
      name: manifest.name,
      displayName: manifest.displayName,
      version: manifest.version,
      ...(manifest.description !== undefined ? { description: manifest.description } : {}),
      manifest: manifest as unknown as Record<string, unknown>,
    });
  }

  private async activate(plugin: DiscoveredPlugin): Promise<void> {
    const { manifest, dir } = plugin;
    if (this.loaded.has(manifest.name)) return;
    const instance = await this.resolveInstance(dir, manifest.name);
    if (!instance) throw new Error(`No loadable entry found for plugin "${manifest.name}"`);

    this.cleanups.set(manifest.name, []);
    this.cleanups.get(manifest.name)?.push(() => this.extensions.unregisterOwner(manifest.name));
    try {
      await instance.onLoad(this.buildContext(manifest.name));
      this.instances.set(manifest.name, instance);
      this.loaded.set(manifest.name, manifest);
      this.logger.log(`Plugin "${manifest.name}" v${manifest.version} loaded`);
    } catch (error) {
      await this.runCleanups(manifest.name);
      throw error;
    }
  }

  private async deactivate(name: string): Promise<void> {
    const instance = this.instances.get(name);
    try {
      await instance?.onUnload?.();
    } catch (error) {
      this.logger.error(`Plugin "${name}" onUnload failed: ${this.errorMessage(error)}`);
    }
    await this.runCleanups(name);
    this.instances.delete(name);
    this.loaded.delete(name);
  }

  private async runCleanups(name: string): Promise<void> {
    const cleanups = this.cleanups.get(name) ?? [];
    for (const cleanup of cleanups.reverse()) {
      try {
        await cleanup();
      } catch (error) {
        this.logger.error(`Plugin "${name}" cleanup failed: ${this.errorMessage(error)}`);
      }
    }
    this.cleanups.delete(name);
  }

  private readManifest(dir: string): PluginManifest | null {
    const manifestPath = path.join(dir, 'kast-plugin.json');
    if (!fs.existsSync(manifestPath)) return null;
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as unknown;
    } catch {
      throw new Error(`Cannot parse manifest at ${manifestPath}`);
    }
    const result = pluginManifestSchema.safeParse(raw);
    if (!result.success)
      throw new Error(`Invalid manifest at ${manifestPath}: ${result.error.message}`);
    return result.data;
  }

  /**
   * Plugin permissions declare the host capabilities a trusted in-process
   * plugin intends to use. They are validated for compatibility, not treated
   * as an OS sandbox: installing third-party code grants it Node process access.
   */
  private enforcePermissions(manifest: PluginManifest): void {
    const disallowed = manifest.permissions.filter(
      (permission) => !ALLOWED_PERMISSIONS.has(permission),
    );
    if (disallowed.length > 0) {
      throw new Error(
        `Plugin "${manifest.name}" requests unsupported capabilities: ${disallowed.join(', ')}`,
      );
    }
  }

  private async resolveInstance(dir: string, name: string): Promise<IKastPlugin | null> {
    const candidates = [path.join(dir, 'dist', 'index.js'), path.join(dir, 'src', 'index.ts')];
    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) continue;
      const instance = await this.importPlugin(candidate, name);
      if (instance) return instance;
    }
    return null;
  }

  private async importPlugin(filePath: string, name: string): Promise<IKastPlugin | null> {
    let mod: unknown;
    try {
      mod = require(filePath) as unknown;
    } catch (requireError) {
      try {
        mod = await dynamicImport(pathToFileURL(filePath).href);
      } catch (importError) {
        this.logger.error(
          `Failed to load plugin "${name}": ${this.errorMessage(requireError)} ` +
            `(import fallback: ${this.errorMessage(importError)})`,
        );
        return null;
      }
    }
    const module = mod as PluginModule;
    const PluginClass = [
      module.default,
      module.Plugin,
      (module.default as PluginModule | undefined)?.default,
    ].find((candidate): candidate is new () => IKastPlugin => typeof candidate === 'function');
    return PluginClass ? new PluginClass() : null;
  }

  private buildContext(pluginName: string): KastPluginContext {
    const logger = new Logger(`Plugin:${pluginName}`);
    return {
      pluginName,
      on: (event: PluginHook, handler: (payload: unknown) => void | Promise<void>): void => {
        const listener = (payload: unknown): void => {
          Promise.resolve(handler(payload)).catch((error: unknown) => {
            logger.error(`Handler for ${String(event)} failed: ${this.errorMessage(error)}`);
          });
        };
        this.eventEmitter.on(event as string, listener);
        this.cleanups.get(pluginName)?.push(() => {
          this.eventEmitter.off(event as string, listener);
        });
      },
      getConfig: () => this.repo.getConfig(pluginName),
      setConfig: (data: Record<string, unknown>) => this.repo.setConfig(pluginName, data),
      registerEmailTransport: (transport) =>
        this.extensions.registerEmailTransport(pluginName, transport),
      registerStorageAdapter: (adapter) =>
        this.extensions.registerStorageAdapter(pluginName, adapter),
      registerErrorReporter: (reporter) =>
        this.extensions.registerErrorReporter(pluginName, reporter),
    };
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

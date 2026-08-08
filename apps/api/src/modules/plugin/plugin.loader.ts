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

// This app compiles to CommonJS, and tsc rewrites a literal `import()` into a
// `require()` call under that target — which cannot load an ES module. Building
// the import through `new Function` keeps it a real dynamic import at runtime.
const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<unknown>;

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
      const instance = await this.importPlugin(candidate, name);
      if (instance) return instance;
    }
    this.logger.warn(`No loadable entry found for plugin "${name}"`);
    return null;
  }

  /**
   * Loads a plugin entry point. CommonJS plugins are require()d; plugins that
   * are ESM (or that pull in an ESM-only dependency, as the Meilisearch plugin
   * does) fail that require and are retried through dynamic import(). Node 20
   * cannot require() an ES module at all, so the import() fallback is what keeps
   * ESM plugins working on the whole supported Node range, not just Node >= 22.
   */
  private async importPlugin(filePath: string, name: string): Promise<IKastPlugin | null> {
    let mod: unknown;
    try {
      mod = require(filePath) as unknown;
    } catch (requireErr) {
      try {
        mod = await dynamicImport(pathToFileURL(filePath).href);
      } catch (importErr) {
        this.logger.error(
          `Failed to load plugin "${name}": ${String(requireErr)} (import fallback: ${String(importErr)})`,
        );
        return null;
      }
    }
    const m = mod as PluginModule;
    // An ESM namespace loaded through interop nests the real exports one level
    // deeper under `default`, so check that shape too.
    const Cls = [m.default, m.Plugin, (m.default as PluginModule | undefined)?.default].find(
      (candidate): candidate is new () => IKastPlugin => typeof candidate === 'function',
    );
    if (!Cls) {
      this.logger.warn(`Plugin "${name}" does not export a default constructor`);
      return null;
    }
    return new Cls();
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

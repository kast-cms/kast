import {
  PluginHook,
  pluginManifestSchema,
  type IKastPlugin,
  type KastPluginContext,
  type PluginManifest,
} from '@kast/plugin-sdk';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs';
import * as path from 'path';
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
    const instance = this.resolveInstance(dir, manifest.name);
    if (!instance) return;
    await this.repo.upsertFromManifest({
      name: manifest.name,
      displayName: manifest.displayName,
      version: manifest.version,
      ...(manifest.description !== undefined ? { description: manifest.description } : {}),
    });
    await instance.onLoad(this.buildContext());
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

  private resolveInstance(dir: string, name: string): IKastPlugin | null {
    const candidates = [path.join(dir, 'dist', 'index.js'), path.join(dir, 'src', 'index.ts')];
    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) continue;
      const instance = this.requirePlugin(candidate, name);
      if (instance) return instance;
    }
    this.logger.warn(`No loadable entry found for plugin "${name}"`);
    return null;
  }

  private requirePlugin(filePath: string, name: string): IKastPlugin | null {
    try {
      // require() is intentional — plugins use CommonJS
      const mod: unknown = require(filePath) as unknown;
      const m = mod as PluginModule;
      const Cls = m.default ?? m.Plugin;
      if (typeof Cls !== 'function') {
        this.logger.warn(`Plugin "${name}" does not export a default constructor`);
        return null;
      }
      return new Cls();
    } catch (err) {
      this.logger.error(`Failed to require plugin "${name}": ${String(err)}`);
      return null;
    }
  }

  private buildContext(): KastPluginContext {
    const emitter = this.eventEmitter;
    return {
      on(event: PluginHook, handler: (payload: unknown) => void | Promise<void>): void {
        emitter.on(event as string, (payload: unknown) => {
          void handler(payload);
        });
      },
    };
  }
}

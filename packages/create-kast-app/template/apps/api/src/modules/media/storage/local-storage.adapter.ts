import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'path';
import type { Env } from '../../../config/env.schema';
import { LOCAL_MEDIA_URL_PATH } from '../media.constants';
import { isSafeObjectKey } from './storage-key.util';
import type { StorageAdapter } from './storage.adapter';

/**
 * The base URLs shipped by env.schema and .env.example before the API served
 * uploads at all. Nothing has ever answered on `/uploads`, so rewriting exactly
 * these two values onto the real route cannot break a deployment; any other
 * value is left alone, since it means a proxy or CDN fronts the directory.
 */
const UNSERVED_LEGACY_BASE_URLS = new Set([
  'http://localhost:3000/uploads',
  'http://localhost:3000/uploads/',
]);

@Injectable()
export class LocalStorageAdapter implements StorageAdapter {
  readonly provider = 'local' as const;

  private readonly localDir: string;
  private readonly localUrl: string;
  private realRoot: string | null = null;

  constructor(config: ConfigService<Env>) {
    const dir = config.get('STORAGE_LOCAL_DIR', { infer: true }) ?? '/tmp/kast-uploads';
    this.localDir = isAbsolute(dir) ? resolve(dir) : resolve(process.cwd(), dir);
    this.localUrl = LocalStorageAdapter.resolveBaseUrl(
      config.get('STORAGE_LOCAL_URL', { infer: true }) ?? '',
    );
  }

  private static resolveBaseUrl(configured: string): string {
    const trimmed = configured.trim();
    if (trimmed === '' || UNSERVED_LEGACY_BASE_URLS.has(trimmed)) {
      const origin = (() => {
        try {
          return new URL(trimmed === '' ? 'http://localhost:3000' : trimmed).origin;
        } catch {
          return 'http://localhost:3000';
        }
      })();
      return `${origin}${LOCAL_MEDIA_URL_PATH}`;
    }
    return trimmed.replace(/\/$/, '');
  }

  async upload(
    key: string,
    buffer: Buffer,
    _mimeType: string,
  ): Promise<{ url: string; storageKey: string }> {
    if (!isSafeObjectKey(key)) {
      throw new Error(`Refusing to write unsafe storage key: ${key}`);
    }
    const filePath = join(this.localDir, key);
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    const url = `${this.localUrl}/${key}`;
    return { url, storageKey: key };
  }

  async read(key: string): Promise<Buffer> {
    const filePath = join(this.localDir, key);
    return fs.readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = join(this.localDir, key);
    await fs.unlink(filePath).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') throw err;
    });
  }

  async getSignedUrl(key: string, _expiresInSeconds: number): Promise<string> {
    return `${this.localUrl}/${key}`;
  }

  /**
   * Location of a stored object, or `null` when the key is unsafe, escapes the
   * upload directory (including through a symlink) or is not a regular file.
   * Returned split so callers can hand `root` to a sender that re-checks
   * containment itself.
   */
  async resolveObject(key: string): Promise<{ root: string; relativePath: string } | null> {
    if (!isSafeObjectKey(key)) return null;
    const root = await this.resolveRoot();
    const candidate = resolve(root, key);
    if (!LocalStorageAdapter.isInside(root, candidate)) return null;

    let real: string;
    try {
      real = await fs.realpath(candidate);
    } catch {
      return null;
    }
    if (!LocalStorageAdapter.isInside(root, real)) return null;

    const stats = await fs.stat(real).catch(() => null);
    if (stats?.isFile() !== true) return null;
    return { root, relativePath: relative(root, real) };
  }

  /** The upload directory itself may sit behind a symlink (macOS /tmp does). */
  private async resolveRoot(): Promise<string> {
    if (this.realRoot !== null) return this.realRoot;
    try {
      this.realRoot = await fs.realpath(this.localDir);
      return this.realRoot;
    } catch {
      return this.localDir;
    }
  }

  private static isInside(root: string, candidate: string): boolean {
    return candidate === root || candidate.startsWith(root.endsWith(sep) ? root : root + sep);
  }
}

import { Injectable, Logger } from '@nestjs/common';
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

/**
 * A path this app has never served. Pointing a base URL here is not rewritten
 * (a CDN legitimately may front `/uploads` on its own host) but it IS worth
 * saying out loud: the repo's own Render blueprint used to set
 * `https://kast-api.onrender.com/uploads`, the API's own origin, where nothing
 * answers — so every media URL 404'd with no signal anywhere (MED-01).
 */
const UNSERVED_PATHS = new Set(['/uploads', '/uploads/']);

@Injectable()
export class LocalStorageAdapter implements StorageAdapter {
  readonly provider = 'local' as const;

  private readonly logger = new Logger(LocalStorageAdapter.name);
  private readonly localDir: string;
  private readonly localUrl: string;
  private realRoot: string | null = null;

  constructor(config: ConfigService<Env>) {
    // Matches the env.schema default. A predictable directory inside the OS
    // temp dir is writable by every local user and is swept on reboot, so it
    // is never a safe default for persisted uploads.
    const dir = config.get('STORAGE_LOCAL_DIR', { infer: true }) ?? './uploads';
    this.localDir = isAbsolute(dir) ? resolve(dir) : resolve(process.cwd(), dir);
    const configured = config.get('STORAGE_LOCAL_URL', { infer: true }) ?? '';
    this.localUrl = LocalStorageAdapter.resolveBaseUrl(configured);
    LocalStorageAdapter.warnIfUnserved(configured, this.localUrl, this.logger);
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

  /**
   * Warns when the configured base URL points at a path this app does not
   * serve. It cannot be auto-corrected — the host may be a CDN that does serve
   * it — so the operator has to decide, and silence was the reason MED-01 shipped.
   */
  private static warnIfUnserved(configured: string, resolved: string, logger: Logger): void {
    const trimmed = configured.trim();
    // Nothing to warn about when the value was rewritten onto the real route.
    if (trimmed === '' || resolved.endsWith(LOCAL_MEDIA_URL_PATH)) return;
    try {
      if (!UNSERVED_PATHS.has(new URL(trimmed).pathname)) return;
    } catch {
      return;
    }
    logger.warn(
      `STORAGE_LOCAL_URL is set to "${trimmed}", but this API serves local media from ` +
        `${LOCAL_MEDIA_URL_PATH}. Unless a proxy or CDN serves that path, every media URL will 404. ` +
        `Leave STORAGE_LOCAL_URL unset to use the built-in route.`,
    );
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
    // `key` is rejected above unless isSafeObjectKey passes (no traversal,
    // dotfiles, backslashes or NUL), and `buffer` reached here only after the
    // media pipeline validated size, content-type and magic bytes.
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
      // `key` passed isSafeObjectKey and the resolve/isInside containment
      // check above; realpath then resolves symlinks so the second isInside
      // check below rejects anything that escapes the root that way.
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

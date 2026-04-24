import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join } from 'path';
import type { Env } from '../../../config/env.schema';
import type { StorageAdapter } from './storage.adapter';

@Injectable()
export class LocalStorageAdapter implements StorageAdapter {
  private readonly localDir: string;
  private readonly localUrl: string;

  constructor(config: ConfigService<Env>) {
    this.localDir = config.get('STORAGE_LOCAL_DIR', { infer: true }) ?? '/tmp/kast-uploads';
    this.localUrl =
      config.get('STORAGE_LOCAL_URL', { infer: true }) ?? 'http://localhost:3000/uploads';
  }

  async upload(
    key: string,
    buffer: Buffer,
    _mimeType: string,
  ): Promise<{ url: string; storageKey: string }> {
    const filePath = join(this.localDir, key);
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, buffer);
    const url = `${this.localUrl}/${key}`;
    return { url, storageKey: key };
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
}

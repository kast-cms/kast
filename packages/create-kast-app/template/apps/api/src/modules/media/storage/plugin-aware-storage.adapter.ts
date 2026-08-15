import type { PluginStorageAdapter } from '@kast-cms/plugin-sdk';
import { Injectable } from '@nestjs/common';
import { PluginExtensionRegistry } from '../../plugin/plugin-extension.registry';
import type { StorageAdapter, StorageProviderId } from './storage.adapter';

/** Delegates to a live plugin adapter when one owns the configured provider. */
@Injectable()
export class PluginAwareStorageAdapter implements StorageAdapter {
  constructor(
    readonly provider: StorageProviderId,
    private readonly fallback: StorageAdapter,
    private readonly extensions: PluginExtensionRegistry,
  ) {}

  async upload(
    key: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ url: string; storageKey: string }> {
    return (this.plugin() ?? this.fallback).upload(key, buffer, mimeType);
  }

  async read(key: string): Promise<Buffer> {
    return Buffer.from(await (this.plugin() ?? this.fallback).read(key));
  }

  delete(key: string): Promise<void> {
    return (this.plugin() ?? this.fallback).delete(key);
  }

  getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    return (this.plugin() ?? this.fallback).getSignedUrl(key, expiresInSeconds);
  }

  private plugin(): PluginStorageAdapter | undefined {
    return this.extensions.getStorageAdapter(this.provider);
  }
}

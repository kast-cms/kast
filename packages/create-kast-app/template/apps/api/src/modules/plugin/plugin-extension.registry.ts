import type {
  PluginEmailTransport,
  PluginErrorReporter,
  PluginStorageAdapter,
} from '@kast-cms/plugin-sdk';
import { Injectable } from '@nestjs/common';

interface Owned<T> {
  owner: string;
  extension: T;
}

/** Live extension points contributed by trusted, enabled in-process plugins. */
@Injectable()
export class PluginExtensionRegistry {
  private readonly emailTransports: Array<Owned<PluginEmailTransport>> = [];
  private readonly storageAdapters: Array<Owned<PluginStorageAdapter>> = [];
  private readonly errorReporters: Array<Owned<PluginErrorReporter>> = [];

  registerEmailTransport(owner: string, extension: PluginEmailTransport): void {
    this.replace(this.emailTransports, owner, extension);
  }

  registerStorageAdapter(owner: string, extension: PluginStorageAdapter): void {
    this.replace(this.storageAdapters, owner, extension);
  }

  registerErrorReporter(owner: string, extension: PluginErrorReporter): void {
    this.replace(this.errorReporters, owner, extension);
  }

  getEmailTransport(): PluginEmailTransport | undefined {
    return this.emailTransports.at(-1)?.extension;
  }

  getStorageAdapter(provider: string): PluginStorageAdapter | undefined {
    return [...this.storageAdapters]
      .reverse()
      .find(({ extension }) => extension.provider === provider)?.extension;
  }

  captureException(error: unknown, context?: Record<string, unknown>): void {
    for (const { extension } of this.errorReporters) {
      extension.captureException(error, context);
    }
  }

  unregisterOwner(owner: string): void {
    this.remove(this.emailTransports, owner);
    this.remove(this.storageAdapters, owner);
    this.remove(this.errorReporters, owner);
  }

  private replace<T>(items: Array<Owned<T>>, owner: string, extension: T): void {
    this.remove(items, owner);
    items.push({ owner, extension });
  }

  private remove<T>(items: Array<Owned<T>>, owner: string): void {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      if (items[index]?.owner === owner) items.splice(index, 1);
    }
  }
}

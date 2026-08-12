import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { SecretEncryptionService } from '../../common/security/secret-encryption.service';
import { isSecretSettingKey } from '../../common/utils/secret-key.util';
import { PrismaService } from '../../prisma/prisma.service';
import type { PluginRecord, UpsertPluginParams } from './dto/plugin.dto';

interface StoredManifest {
  permissions?: unknown;
  hooks?: unknown;
  adminPages?: unknown;
  env?: unknown;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function adminPages(value: unknown): PluginRecord['adminPages'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const page = item as Record<string, unknown>;
    if (typeof page['label'] !== 'string' || typeof page['path'] !== 'string') return [];
    return [
      {
        label: page['label'],
        path: page['path'],
        ...(typeof page['icon'] === 'string' ? { icon: page['icon'] } : {}),
      },
    ];
  });
}

function toRecord(p: {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description: string | null;
  isActive: boolean;
  isInstalled: boolean;
  isSystemPlugin: boolean;
  manifest: Prisma.JsonValue;
  installedAt: Date;
  updatedAt: Date;
}): PluginRecord {
  const manifest = (p.manifest ?? {}) as StoredManifest;
  return {
    id: p.id,
    name: p.name,
    displayName: p.displayName,
    version: p.version,
    description: p.description,
    isActive: p.isActive,
    isInstalled: p.isInstalled,
    isSystemPlugin: p.isSystemPlugin,
    permissions: stringArray(manifest.permissions),
    hooks: stringArray(manifest.hooks),
    adminPages: adminPages(manifest.adminPages),
    env: stringArray(manifest.env),
    installedAt: p.installedAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

@Injectable()
export class PluginRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: SecretEncryptionService,
  ) {}

  async findAll(): Promise<PluginRecord[]> {
    const rows = await this.prisma.plugin.findMany({
      where: { isInstalled: true },
      orderBy: { installedAt: 'asc' },
    });
    return rows.map(toRecord);
  }

  async upsertFromManifest(params: UpsertPluginParams): Promise<PluginRecord> {
    const row = await this.prisma.plugin.upsert({
      where: { name: params.name },
      create: {
        name: params.name,
        displayName: params.displayName,
        version: params.version,
        ...(params.description !== undefined ? { description: params.description } : {}),
        isActive: true,
        isInstalled: true,
        manifest: params.manifest as Prisma.InputJsonValue,
      },
      update: {
        displayName: params.displayName,
        version: params.version,
        ...(params.description !== undefined ? { description: params.description } : {}),
        manifest: params.manifest as Prisma.InputJsonValue,
      },
    });
    return toRecord(row);
  }

  findByName(name: string): Promise<{
    id: string;
    name: string;
    isActive: boolean;
    isInstalled: boolean;
    isSystemPlugin: boolean;
  } | null> {
    return this.prisma.plugin.findUnique({
      where: { name },
      select: { id: true, name: true, isActive: true, isInstalled: true, isSystemPlugin: true },
    });
  }

  async markInstalled(name: string, installed: boolean): Promise<PluginRecord> {
    const row = await this.prisma.plugin.update({
      where: { name },
      data: { isInstalled: installed, isActive: false },
    });
    return toRecord(row);
  }

  async setActive(name: string, isActive: boolean): Promise<PluginRecord> {
    const existing = await this.prisma.plugin.findUnique({ where: { name } });
    if (!existing) throw new NotFoundException(`Plugin "${name}" not found`);
    const row = await this.prisma.plugin.update({
      where: { name },
      data: { isActive },
    });
    return toRecord(row);
  }

  async getConfig(name: string): Promise<Record<string, unknown>> {
    const plugin = await this.prisma.plugin.findUnique({ where: { name } });
    if (!plugin) return {};
    const cfg = await this.prisma.pluginConfig.findUnique({ where: { pluginId: plugin.id } });
    if (!cfg) return {};
    const result = this.revealConfig(cfg.data);
    if (result.rotated) {
      await this.prisma.pluginConfig.update({
        where: { pluginId: plugin.id },
        data: { data: result.stored as Prisma.InputJsonValue },
      });
    }
    return result.plain as Record<string, unknown>;
  }

  async getSafeConfig(name: string): Promise<Record<string, unknown>> {
    return this.maskConfig(await this.getConfig(name)) as Record<string, unknown>;
  }

  async setConfig(name: string, data: Record<string, unknown>): Promise<void> {
    const plugin = await this.prisma.plugin.findUnique({ where: { name } });
    if (!plugin) throw new NotFoundException(`Plugin "${name}" not found`);
    // Cast to Prisma.InputJsonValue — Record<string, unknown> is structurally
    // compatible but not assignable due to exactOptionalPropertyTypes strictness.
    const jsonData = this.protectConfig(data) as Prisma.InputJsonValue;
    await this.prisma.pluginConfig.upsert({
      where: { pluginId: plugin.id },
      create: { pluginId: plugin.id, data: jsonData },
      update: { data: jsonData },
    });
  }

  private protectConfig(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.protectConfig(item));
    if (typeof value !== 'object' || value === null) return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => {
        if (isSecretSettingKey(key)) {
          if (item === '' || item === null || item === undefined) return [key, item ?? null];
          if (typeof item !== 'string') {
            throw new TypeError(`Plugin credential "${key}" must be a string`);
          }
          return [key, this.secrets.encrypt(item)];
        }
        return [key, this.protectConfig(item)];
      }),
    );
  }

  private revealConfig(value: unknown): { plain: unknown; stored: unknown; rotated: boolean } {
    if (Array.isArray(value)) return this.revealArray(value);
    if (typeof value !== 'object' || value === null) {
      return { plain: value, stored: value, rotated: false };
    }
    return this.revealObject(value as Record<string, unknown>);
  }

  private revealArray(value: unknown[]): { plain: unknown; stored: unknown; rotated: boolean } {
    const items = value.map((item) => this.revealConfig(item));
    return {
      plain: items.map((item) => item.plain),
      stored: items.map((item) => item.stored),
      rotated: items.some((item) => item.rotated),
    };
  }

  private revealObject(value: Record<string, unknown>): {
    plain: unknown;
    stored: unknown;
    rotated: boolean;
  } {
    let rotated = false;
    const plain: Record<string, unknown> = {};
    const stored: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (isSecretSettingKey(key) && typeof item === 'string' && item !== '') {
        const result = this.secrets.decryptAndRotate(item);
        plain[key] = result.plaintext;
        stored[key] = result.rotatedCiphertext ?? item;
        rotated ||= result.rotatedCiphertext !== undefined;
      } else {
        const child = this.revealConfig(item);
        plain[key] = child.plain;
        stored[key] = child.stored;
        rotated ||= child.rotated;
      }
    }
    return { plain, stored, rotated };
  }

  private maskConfig(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.maskConfig(item));
    if (typeof value !== 'object' || value === null) return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        isSecretSettingKey(key) ? null : this.maskConfig(item),
      ]),
    );
  }
}

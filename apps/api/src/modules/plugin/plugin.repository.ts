import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { PluginRecord, UpsertPluginParams } from './dto/plugin.dto';

function toRecord(p: {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description: string | null;
  isActive: boolean;
  isSystemPlugin: boolean;
  installedAt: Date;
  updatedAt: Date;
}): PluginRecord {
  return {
    id: p.id,
    name: p.name,
    displayName: p.displayName,
    version: p.version,
    description: p.description,
    isActive: p.isActive,
    isSystemPlugin: p.isSystemPlugin,
    installedAt: p.installedAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

@Injectable()
export class PluginRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<PluginRecord[]> {
    const rows = await this.prisma.plugin.findMany({
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
      },
      update: {
        displayName: params.displayName,
        version: params.version,
        ...(params.description !== undefined ? { description: params.description } : {}),
      },
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
    return cfg.data as Record<string, unknown>;
  }

  async setConfig(name: string, data: Record<string, unknown>): Promise<void> {
    const plugin = await this.prisma.plugin.findUnique({ where: { name } });
    if (!plugin) throw new NotFoundException(`Plugin "${name}" not found`);
    // Cast to Prisma.InputJsonValue — Record<string, unknown> is structurally
    // compatible but not assignable due to exactOptionalPropertyTypes strictness.
    const jsonData = data as unknown as Prisma.InputJsonValue;
    await this.prisma.pluginConfig.upsert({
      where: { pluginId: plugin.id },
      create: { pluginId: plugin.id, data: jsonData },
      update: { data: jsonData },
    });
  }
}

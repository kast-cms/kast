import { Injectable, NotFoundException } from '@nestjs/common';
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
}

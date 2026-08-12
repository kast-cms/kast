import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PluginListResponse, PluginRecord } from './dto/plugin.dto';
import { PluginLoaderService } from './plugin.loader';
import { PluginRepository } from './plugin.repository';

@Injectable()
export class PluginService {
  constructor(
    private readonly repo: PluginRepository,
    private readonly loader: PluginLoaderService,
  ) {}

  async list(): Promise<PluginListResponse> {
    const data = await this.repo.findAll();
    return { data };
  }

  async install(name: string, version: string): Promise<{ data: PluginRecord }> {
    const existing = await this.repo.findByName(name);
    if (existing?.isInstalled) throw new ConflictException(`Plugin "${name}" is already installed`);
    const data = await this.loader.install(name, version);
    return { data };
  }

  async uninstall(name: string): Promise<void> {
    const existing = await this.repo.findByName(name);
    if (!existing?.isInstalled) throw new NotFoundException(`Plugin "${name}" not found`);
    if (existing.isSystemPlugin) {
      throw new ForbiddenException('System plugins cannot be uninstalled');
    }
    await this.loader.uninstall(name);
  }

  async enable(name: string): Promise<{ data: PluginRecord }> {
    const data = await this.loader.enable(name);
    return { data };
  }

  async disable(name: string): Promise<{ data: PluginRecord }> {
    const data = await this.loader.disable(name);
    return { data };
  }

  async getConfig(name: string): Promise<{ data: Record<string, unknown> }> {
    const data = await this.repo.getSafeConfig(name);
    return { data };
  }

  async updateConfig(
    name: string,
    config: Record<string, unknown>,
  ): Promise<{ data: Record<string, unknown> }> {
    await this.repo.setConfig(name, config);
    const data = await this.repo.getSafeConfig(name);
    return { data };
  }
}

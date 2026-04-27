import { Injectable } from '@nestjs/common';
import type { PluginListResponse, PluginRecord } from './dto/plugin.dto';
import { PluginLoaderService } from './plugin.loader';
import { PluginRepository } from './plugin.repository';

@Injectable()
export class PluginService {
  constructor(
    private readonly repo: PluginRepository,
    // loader is injected to trigger OnApplicationBootstrap during module init
    _loader: PluginLoaderService,
  ) {}

  async list(): Promise<PluginListResponse> {
    const data = await this.repo.findAll();
    return { data };
  }

  async enable(name: string): Promise<{ data: PluginRecord }> {
    const data = await this.repo.setActive(name, true);
    return { data };
  }

  async disable(name: string): Promise<{ data: PluginRecord }> {
    const data = await this.repo.setActive(name, false);
    return { data };
  }

  async getConfig(name: string): Promise<{ data: Record<string, unknown> }> {
    const data = await this.repo.getConfig(name);
    return { data };
  }
}

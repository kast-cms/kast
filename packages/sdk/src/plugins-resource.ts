import type { KastClient } from './client.js';
import type { PluginRecord } from './plugin-types.js';
import type { ApiListResponse, ApiResponse } from './types.js';

export class PluginsResource {
  constructor(private readonly client: KastClient) {}

  list(): Promise<ApiListResponse<PluginRecord>> {
    return this.client.request('/api/v1/plugins');
  }

  enable(name: string): Promise<ApiResponse<PluginRecord>> {
    return this.client.request(`/api/v1/plugins/${encodeURIComponent(name)}/enable`, {
      method: 'POST',
    });
  }

  disable(name: string): Promise<ApiResponse<PluginRecord>> {
    return this.client.request(`/api/v1/plugins/${encodeURIComponent(name)}/disable`, {
      method: 'POST',
    });
  }

  getConfig(name: string): Promise<ApiResponse<Record<string, unknown>>> {
    return this.client.request(`/api/v1/plugins/${encodeURIComponent(name)}/config`);
  }
}

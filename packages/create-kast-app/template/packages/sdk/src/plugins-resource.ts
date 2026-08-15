import type { KastClient } from './client.js';
import type { PluginRecord } from './plugin-types.js';
import type { ApiListResponse, ApiResponse } from './types.js';

export class PluginsResource {
  constructor(private readonly client: KastClient) {}

  list(): Promise<ApiListResponse<PluginRecord>> {
    return this.client.request('/api/v1/plugins');
  }

  /**
   * Records a plugin that is already bundled with the target deployment so it
   * can be enabled. Nothing is downloaded: a plugin becomes available only by
   * being placed in the deployment's `plugins/` directory before build.
   */
  register(name: string, version: string): Promise<ApiResponse<PluginRecord>> {
    return this.client.request('/api/v1/plugins/register', {
      method: 'POST',
      body: { name, version },
    });
  }

  /** Unloads the plugin and clears its registration. The code stays on disk. */
  async deregister(name: string): Promise<void> {
    await this.client.request(`/api/v1/plugins/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
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

  updateConfig(
    name: string,
    config: Record<string, unknown>,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.client.request(`/api/v1/plugins/${encodeURIComponent(name)}/config`, {
      method: 'PATCH',
      body: config,
    });
  }
}

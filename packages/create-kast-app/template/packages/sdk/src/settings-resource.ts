import type { KastClient } from './client.js';
import type { GlobalSetting, TestSmtpBody, UpdateSettingsBody } from './settings-types.js';
import type { ApiListResponse } from './types.js';

export class SettingsResource {
  constructor(private readonly client: KastClient) {}

  getAll(): Promise<ApiListResponse<GlobalSetting>> {
    return this.client.request('/api/v1/settings');
  }

  update(body: UpdateSettingsBody): Promise<ApiListResponse<GlobalSetting>> {
    return this.client.request('/api/v1/settings', { method: 'PATCH', body });
  }

  testSmtp(body: TestSmtpBody): Promise<{ success: boolean }> {
    return this.client.request('/api/v1/settings/test-smtp', { method: 'POST', body });
  }

  testStorage(): Promise<{ provider: string; status: string }> {
    return this.client.request('/api/v1/settings/test-storage', { method: 'POST' });
  }
}

import type { KastClient } from './client.js';
import type { CreateLocaleBody, LocaleSummary, UpdateLocaleBody } from './locale-types.js';
import type { ApiResponse } from './types.js';

export class LocalesResource {
  constructor(private readonly client: KastClient) {}

  list(): Promise<{ data: LocaleSummary[] }> {
    return this.client.request('/api/v1/locales');
  }

  create(body: CreateLocaleBody): Promise<ApiResponse<LocaleSummary>> {
    return this.client.request('/api/v1/locales', { method: 'POST', body });
  }

  update(code: string, body: UpdateLocaleBody): Promise<ApiResponse<LocaleSummary>> {
    return this.client.request(`/api/v1/locales/${code}`, { method: 'PATCH', body });
  }

  setDefault(code: string): Promise<ApiResponse<LocaleSummary>> {
    return this.client.request(`/api/v1/locales/${code}/set-default`, { method: 'POST' });
  }

  delete(code: string): Promise<void> {
    return this.client.request(`/api/v1/locales/${code}`, { method: 'DELETE' });
  }
}

import type { KastClient } from './client.js';
import type {
  ApiListResponse,
  ApiResponse,
  ApiTokenCreated,
  ApiTokenSummary,
  CreateApiTokenBody,
} from './types.js';

export class TokensResource {
  constructor(private readonly client: KastClient) {}

  list(): Promise<ApiListResponse<ApiTokenSummary>> {
    return this.client.request('/api/v1/tokens');
  }

  create(data: CreateApiTokenBody): Promise<ApiResponse<ApiTokenCreated>> {
    return this.client.request('/api/v1/tokens', { method: 'POST', body: data });
  }

  revoke(id: string): Promise<void> {
    return this.client.request(`/api/v1/tokens/${id}`, { method: 'DELETE' });
  }
}

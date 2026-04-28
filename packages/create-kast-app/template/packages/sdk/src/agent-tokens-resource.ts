import type {
  AgentTokenCreated,
  AgentTokenSummary,
  CreateAgentTokenBody,
} from './agent-token-types.js';
import type { KastClient } from './client.js';
import type { ApiListResponse, ApiResponse } from './types.js';

export class AgentTokensResource {
  constructor(private readonly client: KastClient) {}

  list(): Promise<ApiListResponse<AgentTokenSummary>> {
    return this.client.request('/api/v1/agent-tokens');
  }

  create(data: CreateAgentTokenBody): Promise<ApiResponse<AgentTokenCreated>> {
    return this.client.request('/api/v1/agent-tokens', { method: 'POST', body: data });
  }

  revoke(id: string): Promise<void> {
    return this.client.request(`/api/v1/agent-tokens/${id}`, { method: 'DELETE' });
  }
}

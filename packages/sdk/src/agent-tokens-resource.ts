import type {
  AgentSessionSummary,
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

  sessions(
    id: string,
    query: { limit?: number; cursor?: string } = {},
  ): Promise<ApiListResponse<AgentSessionSummary>> {
    const search = new URLSearchParams();
    if (query.limit !== undefined) search.set('limit', String(query.limit));
    if (query.cursor) search.set('cursor', query.cursor);
    const suffix = search.size > 0 ? `?${search.toString()}` : '';
    return this.client.request(`/api/v1/agent-tokens/${id}/sessions${suffix}`);
  }
}

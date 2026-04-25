import type { KastClient } from './client.js';
import type {
  ApiListResponse,
  ApiResponse,
  InviteUserBody,
  UpdateUserBody,
  UserListParams,
  UserSummary,
} from './types.js';

export class UsersResource {
  constructor(private readonly client: KastClient) {}

  list(params: UserListParams = {}): Promise<ApiListResponse<UserSummary>> {
    const entries: [string, string][] = [];
    if (params.role !== undefined) entries.push(['role', params.role]);
    if (params.isActive !== undefined) entries.push(['isActive', String(params.isActive)]);
    if (params.limit !== undefined) entries.push(['limit', String(params.limit)]);
    if (params.cursor !== undefined) entries.push(['cursor', params.cursor]);
    const qs = new URLSearchParams(entries).toString();
    return this.client.request(`/api/v1/users${qs ? `?${qs}` : ''}`);
  }

  get(id: string): Promise<ApiResponse<UserSummary>> {
    return this.client.request(`/api/v1/users/${id}`);
  }

  invite(data: InviteUserBody): Promise<ApiResponse<UserSummary>> {
    return this.client.request('/api/v1/users', { method: 'POST', body: data });
  }

  update(id: string, data: UpdateUserBody): Promise<ApiResponse<UserSummary>> {
    return this.client.request(`/api/v1/users/${id}`, { method: 'PATCH', body: data });
  }

  trash(id: string): Promise<ApiResponse<{ id: string; trashedAt: string }>> {
    return this.client.request(`/api/v1/users/${id}`, { method: 'DELETE' });
  }
}

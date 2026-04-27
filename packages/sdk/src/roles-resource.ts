import type { KastClient } from './client.js';
import type {
  ApiListResponse,
  ApiResponse,
  AssignPermissionsBody,
  CreateRoleBody,
  RoleDetail,
  RoleSummary,
  UpdateRoleBody,
} from './types.js';

export class RolesResource {
  constructor(private readonly client: KastClient) {}

  list(): Promise<ApiListResponse<RoleSummary>> {
    return this.client.request('/api/v1/roles');
  }

  get(id: string): Promise<ApiResponse<RoleDetail>> {
    return this.client.request(`/api/v1/roles/${id}`);
  }

  create(data: CreateRoleBody): Promise<ApiResponse<RoleSummary>> {
    return this.client.request('/api/v1/roles', { method: 'POST', body: data });
  }

  update(id: string, data: UpdateRoleBody): Promise<ApiResponse<RoleSummary>> {
    return this.client.request(`/api/v1/roles/${id}`, { method: 'PATCH', body: data });
  }

  delete(id: string): Promise<void> {
    return this.client.request(`/api/v1/roles/${id}`, { method: 'DELETE' });
  }

  assignPermissions(id: string, data: AssignPermissionsBody): Promise<ApiResponse<RoleDetail>> {
    return this.client.request(`/api/v1/roles/${id}/permissions`, { method: 'POST', body: data });
  }

  removePermission(roleId: string, permId: string): Promise<void> {
    return this.client.request(`/api/v1/roles/${roleId}/permissions/${permId}`, {
      method: 'DELETE',
    });
  }
}

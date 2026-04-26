import type { KastClient } from './client.js';
import type {
  AddFieldBody,
  ApiListResponse,
  ApiResponse,
  ContentField,
  ContentTypeDetail,
  ContentTypeSummary,
  CreateContentTypeBody,
  ReorderFieldsBody,
  UpdateContentTypeBody,
  UpdateFieldBody,
} from './types.js';

export class AuthResource {
  constructor(private readonly client: KastClient) {}

  login(email: string, password: string): Promise<unknown> {
    return this.client.request('/api/v1/auth/login', { method: 'POST', body: { email, password } });
  }

  refresh(refreshToken: string): Promise<unknown> {
    return this.client.request('/api/v1/auth/refresh', { method: 'POST', body: { refreshToken } });
  }

  me(): Promise<unknown> {
    return this.client.request('/api/v1/auth/me');
  }
}

export class ContentTypesResource {
  constructor(private readonly client: KastClient) {}

  list(): Promise<ApiListResponse<ContentTypeSummary>> {
    return this.client.request('/api/v1/content-types');
  }

  get(name: string): Promise<ApiResponse<ContentTypeDetail>> {
    return this.client.request(`/api/v1/content-types/${name}`);
  }

  create(data: CreateContentTypeBody): Promise<ApiResponse<ContentTypeDetail>> {
    return this.client.request('/api/v1/content-types', { method: 'POST', body: data });
  }

  update(name: string, data: UpdateContentTypeBody): Promise<ApiResponse<ContentTypeDetail>> {
    return this.client.request(`/api/v1/content-types/${name}`, { method: 'PATCH', body: data });
  }

  delete(name: string): Promise<void> {
    return this.client.request(`/api/v1/content-types/${name}`, { method: 'DELETE' });
  }

  addField(name: string, data: AddFieldBody): Promise<ApiResponse<ContentField>> {
    return this.client.request(`/api/v1/content-types/${name}/fields`, {
      method: 'POST',
      body: data,
    });
  }

  updateField(
    name: string,
    fieldName: string,
    data: UpdateFieldBody,
  ): Promise<ApiResponse<ContentField>> {
    return this.client.request(`/api/v1/content-types/${name}/fields/${fieldName}`, {
      method: 'PATCH',
      body: data,
    });
  }

  deleteField(name: string, fieldName: string): Promise<void> {
    return this.client.request(`/api/v1/content-types/${name}/fields/${fieldName}`, {
      method: 'DELETE',
    });
  }

  reorderFields(name: string, data: ReorderFieldsBody): Promise<ApiResponse<ContentTypeDetail>> {
    return this.client.request(`/api/v1/content-types/${name}/fields/reorder`, {
      method: 'PATCH',
      body: data,
    });
  }
}

export class HealthResource {
  constructor(private readonly client: KastClient) {}

  check(): Promise<unknown> {
    return this.client.request('/api/v1/health');
  }
}

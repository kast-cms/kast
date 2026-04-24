import type {
  AddFieldBody,
  ApiListResponse,
  ApiResponse,
  BulkActionBody,
  ContentEntryDetail,
  ContentEntrySummary,
  ContentField,
  ContentTypeDetail,
  ContentTypeSummary,
  CreateContentTypeBody,
  CreateEntryBody,
  EntryListParams,
  KastClientOptions,
  ReorderFieldsBody,
  UpdateContentTypeBody,
  UpdateEntryBody,
  UpdateFieldBody,
} from './types.js';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export class KastClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private accessToken: string | undefined;
  private readonly _fetch: typeof globalThis.fetch;

  constructor(options: KastClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.accessToken = options.accessToken;
    this._fetch = options.fetch ?? globalThis.fetch;
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;
    else if (this.apiKey) headers['X-Kast-Key'] = this.apiKey;
    return headers;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await this._fetch(url, {
      method: options.method ?? 'GET',
      headers: { ...this.buildHeaders(), ...(options.headers ?? {}) },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
    const json = (await res.json()) as unknown;
    if (!res.ok) {
      const err = (json as { error?: { message?: string; code?: string } }).error;
      const message = err?.message ?? `HTTP ${res.status}`;
      const error = new Error(message) as Error & { code?: string; status?: number };
      if (err?.code !== undefined) error.code = err.code;
      error.status = res.status;
      throw error;
    }
    return json as T;
  }

  get auth(): AuthResource {
    return new AuthResource(this);
  }

  get contentTypes(): ContentTypesResource {
    return new ContentTypesResource(this);
  }

  get content(): ContentResource {
    return new ContentResource(this);
  }

  get media(): MediaResource {
    return new MediaResource(this);
  }

  get health(): HealthResource {
    return new HealthResource(this);
  }
}

class AuthResource {
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

class ContentTypesResource {
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

class ContentResource {
  constructor(private readonly client: KastClient) {}

  list(
    typeSlug: string,
    params: EntryListParams = {},
  ): Promise<ApiListResponse<ContentEntrySummary>> {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries${qs ? `?${qs}` : ''}`);
  }

  get(typeSlug: string, id: string, locale?: string): Promise<ApiResponse<ContentEntryDetail>> {
    const qs = locale !== undefined ? `?locale=${locale}` : '';
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries/${id}${qs}`);
  }

  create(typeSlug: string, data: CreateEntryBody): Promise<ApiResponse<ContentEntryDetail>> {
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries`, {
      method: 'POST',
      body: data,
    });
  }

  update(
    typeSlug: string,
    id: string,
    data: UpdateEntryBody,
  ): Promise<ApiResponse<ContentEntryDetail>> {
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries/${id}`, {
      method: 'PATCH',
      body: data,
    });
  }

  publish(typeSlug: string, id: string): Promise<ApiResponse<ContentEntryDetail>> {
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries/${id}/publish`, {
      method: 'POST',
    });
  }

  unpublish(typeSlug: string, id: string): Promise<ApiResponse<ContentEntryDetail>> {
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries/${id}/unpublish`, {
      method: 'POST',
    });
  }

  trash(typeSlug: string, id: string): Promise<void> {
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries/${id}`, {
      method: 'DELETE',
    });
  }

  bulkTrash(typeSlug: string, ids: string[]): Promise<void> {
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries/bulk/trash`, {
      method: 'POST',
      body: { ids } satisfies BulkActionBody,
    });
  }

  bulkPublish(typeSlug: string, ids: string[]): Promise<void> {
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries/bulk/publish`, {
      method: 'POST',
      body: { ids } satisfies BulkActionBody,
    });
  }

  bulkUnpublish(typeSlug: string, ids: string[]): Promise<void> {
    return this.client.request(`/api/v1/content-types/${typeSlug}/entries/bulk/unpublish`, {
      method: 'POST',
      body: { ids } satisfies BulkActionBody,
    });
  }
}

class MediaResource {
  constructor(private readonly client: KastClient) {}

  list(params: Record<string, string> = {}): Promise<unknown> {
    const qs = new URLSearchParams(params).toString();
    return this.client.request(`/api/v1/media${qs ? `?${qs}` : ''}`);
  }

  get(id: string): Promise<unknown> {
    return this.client.request(`/api/v1/media/${id}`);
  }

  delete(id: string): Promise<unknown> {
    return this.client.request(`/api/v1/media/${id}`, { method: 'DELETE' });
  }
}

class HealthResource {
  constructor(private readonly client: KastClient) {}

  check(): Promise<unknown> {
    return this.client.request('/api/v1/health');
  }
}

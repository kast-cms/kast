import type { KastClient } from './client.js';
import type {
  CreateRedirectBody,
  Redirect,
  SeoMeta,
  SeoScore,
  UpdateRedirectBody,
  UpsertSeoMetaBody,
} from './seo-types.js';
import type { ApiListResponse, ApiResponse } from './types.js';

export class SeoResource {
  constructor(private readonly client: KastClient) {}

  getMeta(entryId: string): Promise<ApiResponse<SeoMeta>> {
    return this.client.request(`/api/v1/seo/meta/${entryId}`);
  }

  upsertMeta(entryId: string, body: UpsertSeoMetaBody): Promise<ApiResponse<SeoMeta>> {
    return this.client.request(`/api/v1/seo/meta/${entryId}`, { method: 'PUT', body });
  }

  getScore(entryId: string): Promise<ApiResponse<SeoScore>> {
    return this.client.request(`/api/v1/seo/score/${entryId}`);
  }

  validate(entryId: string): Promise<{ queued: boolean }> {
    return this.client.request(`/api/v1/seo/validate/${entryId}`, { method: 'POST' });
  }

  getSitemap(): Promise<string> {
    return this.client.request('/api/v1/seo/sitemap.xml');
  }

  listRedirects(params?: { limit?: number; cursor?: string }): Promise<ApiListResponse<Redirect>> {
    const q = new URLSearchParams();
    if (params?.limit !== undefined) q.set('limit', String(params.limit));
    if (params?.cursor !== undefined) q.set('cursor', params.cursor);
    const qs = q.toString();
    return this.client.request(`/api/v1/seo/redirects${qs ? `?${qs}` : ''}`);
  }

  createRedirect(body: CreateRedirectBody): Promise<ApiResponse<Redirect>> {
    return this.client.request('/api/v1/seo/redirects', { method: 'POST', body });
  }

  updateRedirect(id: string, body: UpdateRedirectBody): Promise<ApiResponse<Redirect>> {
    return this.client.request(`/api/v1/seo/redirects/${id}`, { method: 'PATCH', body });
  }

  deleteRedirect(id: string): Promise<void> {
    return this.client.request(`/api/v1/seo/redirects/${id}`, { method: 'DELETE' });
  }
}

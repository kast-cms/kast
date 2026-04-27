import type { KastClient } from './client.js';
import type {
  CreateFormBody,
  FormDetail,
  FormSummary,
  ListSubmissionsParams,
  PaginatedSubmissions,
  SubmitFormBody,
  UpdateFormBody,
} from './form-types.js';
import type { ApiResponse } from './types.js';

export class FormsResource {
  constructor(private readonly client: KastClient) {}

  list(): Promise<FormSummary[]> {
    return this.client.request('/api/v1/forms');
  }

  create(body: CreateFormBody): Promise<FormDetail> {
    return this.client.request('/api/v1/forms', { method: 'POST', body });
  }

  findOne(id: string): Promise<FormDetail> {
    return this.client.request(`/api/v1/forms/${encodeURIComponent(id)}`);
  }

  update(id: string, body: UpdateFormBody): Promise<FormDetail> {
    return this.client.request(`/api/v1/forms/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body,
    });
  }

  delete(id: string): Promise<void> {
    return this.client.request(`/api/v1/forms/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  submit(id: string, body: SubmitFormBody): Promise<ApiResponse<{ ok: boolean }>> {
    return this.client.request(`/api/v1/forms/${encodeURIComponent(id)}/submit`, {
      method: 'POST',
      body,
    });
  }

  listSubmissions(id: string, params?: ListSubmissionsParams): Promise<PaginatedSubmissions> {
    const qs = new URLSearchParams();
    if (params?.from !== undefined) qs.set('from', params.from);
    if (params?.to !== undefined) qs.set('to', params.to);
    if (params?.page !== undefined) qs.set('page', String(params.page));
    if (params?.limit !== undefined) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return this.client.request(
      `/api/v1/forms/${encodeURIComponent(id)}/submissions${query ? `?${query}` : ''}`,
    );
  }

  deleteSubmission(formId: string, subId: string): Promise<void> {
    return this.client.request(
      `/api/v1/forms/${encodeURIComponent(formId)}/submissions/${encodeURIComponent(subId)}`,
      { method: 'DELETE' },
    );
  }

  exportCsvUrl(id: string): string {
    return `/api/v1/forms/${encodeURIComponent(id)}/submissions/export`;
  }
}

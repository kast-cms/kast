import type { KastClient } from './client.js';
import type {
  CreateFormBody,
  FormDetail,
  FormSubmissionSummary,
  FormSummary,
  ListSubmissionsParams,
  PaginatedSubmissions,
  SubmitFormBody,
  UpdateFormBody,
} from './form-types.js';

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

  /**
   * Submits a public form. The response is the bare `{ ok: true }` the route
   * returns, NOT an `{ data }` envelope.
   *
   * `ok` is not proof the submission was stored: an unknown, trashed or inactive
   * form answers identically so the endpoint cannot be used to enumerate forms.
   * A submission that fails validation is a 400 with code `FORM_SUBMISSION_INVALID`
   * and an `errors: [{ field, rule, message }]` array.
   */
  submit(id: string, body: SubmitFormBody): Promise<{ ok: boolean }> {
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

  /**
   * Marks a submission read (default) or unread. `readAt` is set on read and
   * cleared on unread. 404s when the submission does not belong to `formId`.
   */
  markSubmissionRead(formId: string, subId: string, isRead = true): Promise<FormSubmissionSummary> {
    return this.client.request(
      `/api/v1/forms/${encodeURIComponent(formId)}/submissions/${encodeURIComponent(subId)}/read`,
      { method: 'PATCH', body: { isRead } },
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

  /** @alias findOne */
  get(id: string): Promise<FormDetail> {
    return this.findOne(id);
  }

  /** @alias listSubmissions */
  getSubmissions(id: string, params?: ListSubmissionsParams): Promise<PaginatedSubmissions> {
    return this.listSubmissions(id, params);
  }

  /**
   * Fetches the CSV export as a Blob. Uses `requestBlob`: the route replies with
   * `text/csv`, which `request` would try to parse as JSON and throw on.
   */
  exportCsv(id: string): Promise<Blob> {
    return this.client.requestBlob(this.exportCsvUrl(id));
  }
}

import type { AuditLogEntry, AuditLogListParams, AuditLogListResponse } from './audit-types.js';
import type { KastClient } from './client.js';

function buildAuditParams(params: AuditLogListParams): URLSearchParams {
  const search = new URLSearchParams();
  if (params.action) search.set('action', params.action);
  if (params.resource) search.set('resource', params.resource);
  if (params.userId) search.set('userId', params.userId);
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  if (params.limit !== undefined) search.set('limit', String(params.limit));
  if (params.cursor) search.set('cursor', params.cursor);
  return search;
}

export class AuditResource {
  constructor(private readonly client: KastClient) {}

  list(params?: AuditLogListParams): Promise<AuditLogListResponse> {
    const qs = params ? buildAuditParams(params).toString() : '';
    return this.client.request(`/api/v1/audit${qs ? `?${qs}` : ''}`);
  }

  getById(id: string): Promise<{ data: AuditLogEntry }> {
    return this.client.request(`/api/v1/audit/${id}`);
  }

  /** Download audit log as a CSV Blob (max 5 000 rows). */
  export(params?: AuditLogListParams): Promise<Blob> {
    const qs = params ? buildAuditParams(params).toString() : '';
    return this.client.requestBlob(`/api/v1/audit/export${qs ? `?${qs}` : ''}`);
  }
}

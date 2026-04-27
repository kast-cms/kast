import type { KastClient } from './client.js';
import type { TrashListParams, TrashListResponse, TrashModel } from './trash-types.js';

export class TrashResource {
  constructor(private readonly client: KastClient) {}

  list(params: TrashListParams = {}): Promise<TrashListResponse> {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return this.client.request(`/api/v1/trash${qs ? `?${qs}` : ''}`);
  }

  restore(model: TrashModel, id: string): Promise<void> {
    return this.client.request(
      `/api/v1/trash/${encodeURIComponent(model)}/${encodeURIComponent(id)}/restore`,
      { method: 'POST' },
    );
  }

  permanentDelete(model: TrashModel, id: string): Promise<void> {
    return this.client.request(
      `/api/v1/trash/${encodeURIComponent(model)}/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  }
}

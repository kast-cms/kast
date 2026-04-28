import type { KastClient } from './client.js';
import type { ContentEntryVersion, VersionListParams } from './content-version-types.js';
import type { ApiListResponse, ApiResponse, ContentEntryDetail } from './types.js';

export class VersionsResource {
  constructor(private readonly client: KastClient) {}

  list(
    typeSlug: string,
    entryId: string,
    params: VersionListParams = {},
  ): Promise<ApiListResponse<ContentEntryVersion>> {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return this.client.request(
      `/api/v1/content-types/${typeSlug}/entries/${entryId}/versions${qs ? `?${qs}` : ''}`,
    );
  }

  get(
    typeSlug: string,
    entryId: string,
    versionId: string,
  ): Promise<ApiResponse<ContentEntryVersion>> {
    return this.client.request(
      `/api/v1/content-types/${typeSlug}/entries/${entryId}/versions/${versionId}`,
    );
  }

  revert(
    typeSlug: string,
    entryId: string,
    versionId: string,
  ): Promise<ApiResponse<ContentEntryDetail>> {
    return this.client.request(
      `/api/v1/content-types/${typeSlug}/entries/${entryId}/versions/${versionId}/revert`,
      { method: 'POST' },
    );
  }
}

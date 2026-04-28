import type {
  ApiListResponse,
  ApiResponse,
  CreateFolderBody,
  MediaFileDetail,
  MediaFileSummary,
  MediaFolder,
  MediaListParams,
  UpdateFolderBody,
  UpdateMediaBody,
} from './types.js';

interface Requester {
  request<T>(
    path: string,
    opts?: { method?: string; body?: unknown; formData?: FormData },
  ): Promise<T>;
}

export class MediaResource {
  constructor(private readonly client: Requester) {}

  list(params: MediaListParams = {}): Promise<ApiListResponse<MediaFileSummary>> {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return this.client.request(`/api/v1/media${qs ? `?${qs}` : ''}`);
  }

  get(id: string): Promise<ApiResponse<MediaFileDetail>> {
    return this.client.request(`/api/v1/media/${id}`);
  }

  upload(formData: FormData): Promise<ApiResponse<MediaFileSummary>> {
    return this.client.request('/api/v1/media/upload', { method: 'POST', formData });
  }

  uploadUrl(body: {
    url: string;
    folderId?: string;
    altText?: string;
  }): Promise<ApiResponse<MediaFileSummary>> {
    return this.client.request('/api/v1/media/upload-url', { method: 'POST', body });
  }

  update(id: string, body: UpdateMediaBody): Promise<ApiResponse<MediaFileSummary>> {
    return this.client.request(`/api/v1/media/${id}`, { method: 'PATCH', body });
  }

  trash(id: string): Promise<ApiResponse<{ id: string; trashedAt: string }>> {
    return this.client.request(`/api/v1/media/${id}`, { method: 'DELETE' });
  }

  listFolders(): Promise<ApiListResponse<MediaFolder>> {
    return this.client.request('/api/v1/media/folders');
  }

  createFolder(body: CreateFolderBody): Promise<ApiResponse<MediaFolder>> {
    return this.client.request('/api/v1/media/folders', { method: 'POST', body });
  }

  updateFolder(id: string, body: UpdateFolderBody): Promise<ApiResponse<MediaFolder>> {
    return this.client.request(`/api/v1/media/folders/${id}`, { method: 'PATCH', body });
  }

  deleteFolder(id: string): Promise<void> {
    return this.client.request(`/api/v1/media/folders/${id}`, { method: 'DELETE' });
  }
}

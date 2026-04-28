export interface ContentEntryVersion {
  id: string;
  versionNumber: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'SCHEDULED';
  data: Record<string, unknown>;
  savedById: string;
  savedByName: string | null;
  createdAt: string;
}

export interface VersionListParams {
  limit?: string;
  cursor?: string;
}

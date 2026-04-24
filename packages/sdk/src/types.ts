export interface KastClientOptions {
  baseUrl: string;
  apiKey?: string;
  accessToken?: string;
  fetch?: typeof globalThis.fetch;
}

/* ── API types ─────────────────────────────────────────────── */

export interface ApiResponse<T> {
  data: T;
}

export interface ApiListResponse<T> {
  data: T[];
  meta: {
    total: number;
    limit: number;
    cursor: string | null;
    hasNextPage: boolean;
  };
}

export type ContentFieldType =
  | 'TEXT'
  | 'RICH_TEXT'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'DATE'
  | 'MEDIA'
  | 'RELATION'
  | 'JSON'
  | 'EMAIL'
  | 'URL'
  | 'ENUM'
  | 'UID';

export interface ContentField {
  id: string;
  name: string;
  displayName: string;
  type: ContentFieldType;
  isRequired: boolean;
  isLocalized: boolean;
  isUnique: boolean;
  isHidden: boolean;
  position: number;
  config: Record<string, unknown>;
  defaultValue: unknown;
}

export interface ContentTypeSummary {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  icon: string | null;
  isSystem: boolean;
  fieldsCount: number;
  entriesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContentTypeDetail extends ContentTypeSummary {
  fields: ContentField[];
}

export interface CreateContentTypeBody {
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
}

export interface UpdateContentTypeBody {
  displayName?: string;
  description?: string | null;
  icon?: string | null;
}

export interface AddFieldBody {
  name: string;
  displayName: string;
  type: ContentFieldType;
  isRequired?: boolean;
  isLocalized?: boolean;
  isUnique?: boolean;
  isHidden?: boolean;
  position?: number;
  config?: Record<string, unknown>;
  defaultValue?: unknown;
}

export interface UpdateFieldBody {
  displayName?: string | null;
  isRequired?: boolean;
  isLocalized?: boolean;
  isUnique?: boolean;
  isHidden?: boolean;
  config?: Record<string, unknown>;
  defaultValue?: unknown;
}

export interface ReorderFieldsBody {
  order: string[]; // field names in desired order
}

export type EntryStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface ContentEntrySummary {
  id: string;
  status: EntryStatus;
  locale: string;
  titleField: string | null; // value of the first text field
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  scheduledAt: string | null;
}

export interface ContentEntryDetail {
  id: string;
  status: EntryStatus;
  locale: string;
  data: Record<string, unknown>;
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  scheduledAt: string | null;
}

export interface CreateEntryBody {
  locale?: string;
  data: Record<string, unknown>;
  status?: EntryStatus;
}

export interface UpdateEntryBody {
  data?: Record<string, unknown>;
  status?: EntryStatus;
  scheduledAt?: string | null;
}

export interface BulkActionBody {
  ids: string[];
}

export interface EntryListParams {
  search?: string;
  status?: EntryStatus;
  locale?: string;
  cursor?: string;
  limit?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

/* ── Media ───────────────────────────────────────────────── */

export interface MediaUsage {
  entryId: string;
  contentType: string;
  fieldName: string;
  entryTitle: string | null;
}

export interface MediaFolder {
  id: string;
  name: string;
  parentId: string | null;
  filesCount: number;
  children: MediaFolder[];
}

export interface MediaFileSummary {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  provider: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  isAiAltText: boolean;
  isAiGenerated: boolean;
  folder: { id: string; name: string } | null;
  usagesCount: number;
  createdAt: string;
}

export interface MediaFileDetail extends MediaFileSummary {
  usages: MediaUsage[];
  updatedAt: string;
}

export interface MediaListParams {
  folderId?: string;
  mimeType?: string;
  search?: string;
  limit?: string;
  cursor?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface UpdateMediaBody {
  altText?: string | null;
  folderId?: string | null;
}

export interface CreateFolderBody {
  name: string;
  parentId?: string;
}

export interface UpdateFolderBody {
  name?: string;
  parentId?: string | null;
}

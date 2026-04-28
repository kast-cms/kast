/* ── Session & Auth ─────────────────────────────── */

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: SessionUser;
}

export interface SessionUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
}

export interface Session {
  user: SessionUser;
  accessToken: string;
  expiresAt: number; // Unix ms
}

/* ── API response envelope ──────────────────────── */

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
}

/* ── Navigation ──────────────────────────────────── */

export interface NavItem {
  label: string;
  href: string;
  icon: string; // lucide icon name
  badge?: number;
}

/* ── Content Types ───────────────────────────────── */

export type {
  AddFieldBody,
  ApiTokenCreated,
  ApiTokenSummary,
  AssignPermissionsBody,
  BulkActionBody,
  ContentEntryDetail,
  ContentEntrySummary,
  ContentField,
  ContentFieldType,
  ContentTypeDetail,
  ContentTypeSummary,
  CreateApiTokenBody,
  CreateContentTypeBody,
  CreateEntryBody,
  CreateFolderBody,
  CreateRedirectBody,
  CreateRoleBody,
  EntryListParams,
  EntryStatus,
  InviteUserBody,
  IssueSeverity,
  MediaFileDetail,
  MediaFileSummary,
  MediaFolder,
  MediaListParams,
  MediaUsage,
  Permission,
  Redirect,
  RedirectType,
  ReorderFieldsBody,
  RoleDetail,
  RoleSummary,
  SeoIssue,
  SeoMeta,
  SeoScore,
  TokenScope,
  UpdateContentTypeBody,
  UpdateEntryBody,
  UpdateFieldBody,
  UpdateFolderBody,
  UpdateMediaBody,
  UpdateRedirectBody,
  UpdateRoleBody,
  UpdateUserBody,
  UpsertSeoMetaBody,
  UserListParams,
  UserSummary,
} from '@kast-cms/sdk';

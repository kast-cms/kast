/* eslint-disable max-lines */
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

export interface AuthUserSummary {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  roles: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUserSummary;
}

export interface MfaChallenge {
  mfaRequired: true;
  challengeToken: string;
  expiresIn: number;
  user: AuthUserSummary;
}

export type LoginResult = TokenPair | MfaChallenge;

export interface MfaStatus {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodeCount: number;
}

export interface MfaSetup {
  secret: string;
  otpauthUrl: string;
}

export interface MfaSetupVerified {
  enabled: true;
  recoveryCodes: string[];
}

export interface SessionSummary {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
}

/** Mirrors the Prisma `ContentFieldType` enum exactly. */
export type ContentFieldType =
  | 'TEXT'
  | 'RICH_TEXT'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'DATE'
  | 'DATETIME'
  | 'MEDIA'
  | 'RELATION'
  | 'JSON'
  | 'COMPONENT'
  | 'BLOCK'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'COLOR'
  | 'URL'
  | 'EMAIL';

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
  /** Entries of a localized type carry a row per active locale. */
  isLocalized: boolean;
  isPubliclyDiscoverable: boolean;
  fields: ContentField[];
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
  isLocalized?: boolean;
  isPubliclyDiscoverable?: boolean;
}

export interface UpdateContentTypeBody {
  displayName?: string;
  description?: string | null;
  icon?: string | null;
  isLocalized?: boolean;
  isPubliclyDiscoverable?: boolean;
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

export type EntryStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'SCHEDULED';
export type EntryReviewStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'CHANGES_REQUESTED';

export interface SchedulePublishBody {
  publishAt: string;
}

/** One translation of an entry, as stored. */
export interface ContentEntryLocale {
  id: string;
  entryId: string;
  localeCode: string;
  slug: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * The requested locale flattened onto the entry (`locale`, `slug`, `data`), with
 * every stored translation still available under `locales`.
 */
export interface ContentEntryDetail {
  id: string;
  contentTypeId: string;
  status: EntryStatus;
  reviewStatus: EntryReviewStatus;
  locale: string | null;
  slug: string | null;
  data: Record<string, unknown>;
  authorId: string | null;
  authorName: string | null;
  isAiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  scheduledAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedById: string | null;
  lockedById: string | null;
  lockExpiresAt: string | null;
  trashedAt: string | null;
  locales: ContentEntryLocale[];
}

export interface ContentEntrySummary extends ContentEntryDetail {
  /** Value of the type's first TEXT field in the active locale. */
  titleField: string | null;
}

/**
 * Entries are always created as drafts — the API rejects a `status` here — and
 * moved on with publish() / unpublish() / archive() or schedulePublish().
 */
export interface CreateEntryBody {
  locale?: string;
  /**
   * URL slug for this locale. Normalized to lower case with non-alphanumeric runs
   * folded to hyphens, and unique per locale. Falls back to a `slug` key inside
   * `data`, then to a generated value.
   */
  slug?: string;
  data: Record<string, unknown>;
}

export interface UpdateEntryBody {
  locale?: string;
  /** Rewrites the slug of the locale being written. */
  slug?: string;
  data?: Record<string, unknown>;
  status?: EntryStatus;
  scheduledAt?: string | null;
  expectedUpdatedAt?: string;
}

export interface ContentVersionDiff {
  fromVersionId: string;
  fromVersionNumber: number;
  to: 'current';
  changes: Array<{
    path: string;
    before: unknown;
    after: unknown;
    type: 'added' | 'removed' | 'changed';
  }>;
}

export interface ContentExportBundle {
  formatVersion: 1;
  exportedAt: string;
  contentType: ContentTypeDetail;
  entries: Array<
    ContentEntryDetail & {
      versions: Array<{
        id: string;
        versionNumber: number;
        status: EntryStatus;
        data: Record<string, unknown>;
        localesData: Record<string, unknown>;
        createdAt: string;
      }>;
    }
  >;
}

export interface ImportContentBody {
  entries: Array<{
    id?: string;
    status?: EntryStatus;
    locales: Array<{ localeCode: string; slug: string; data: Record<string, unknown> }>;
    versions?: Array<{
      versionNumber: number;
      status?: EntryStatus;
      data: Record<string, unknown>;
      localesData: Record<string, unknown>;
    }>;
  }>;
  overwrite?: boolean;
}

export interface ImportWordPressBody {
  locale?: string;
  posts: Array<{
    title: string;
    content: string;
    slug?: string;
    excerpt?: string;
    status?: string;
    date?: string;
  }>;
}

export interface PublishEntryBody {
  /** Publish despite SEO warnings. Errors still block. */
  force?: boolean;
}

export interface BulkActionBody {
  ids: string[];
}

export interface BulkActionItemResult {
  id: string;
  ok: boolean;
  error?: { status: number; code: string; message: string };
}

/**
 * Bulk actions are per-item and not atomic: a failure is reported against its own
 * id and does not roll back the ids that succeeded.
 */
export interface BulkActionResult {
  results: BulkActionItemResult[];
  succeeded: number;
  failed: number;
}

export interface EntryListParams {
  search?: string;
  status?: EntryStatus;
  locale?: string;
  cursor?: string;
  limit?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  scheduledAt?: string;
}

export type { ContentEntryVersion, VersionListParams } from './content-version-types.js';

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
  totalSize: number;
  url: string;
  provider: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  caption: string | null;
  originalStorageKey: string | null;
  originalUrl: string | null;
  originalSize: number | null;
  optimizedSize: number | null;
  thumbnailSize: number;
  thumbnails: Record<string, { url: string; size: number }>;
  variantSize: number;
  variants: Record<
    string,
    { url: string; size: number; width: number; height: number; mimeType: string }
  >;
  focalPoint: { x: number; y: number } | null;
  deliveryTransforms: Record<string, unknown>;
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
  caption?: string | null;
  folderId?: string | null;
  focalPoint?: { x: number; y: number } | null;
}

export interface CreateFolderBody {
  name: string;
  parentId?: string;
}

export interface UpdateFolderBody {
  name?: string;
  parentId?: string | null;
}

export type {
  ApiTokenCreated,
  ApiTokenSummary,
  AssignPermissionsBody,
  CreateApiTokenBody,
  CreateRoleBody,
  InviteUserBody,
  Permission,
  RoleDetail,
  RoleSummary,
  TokenScope,
  UpdateRoleBody,
  UpdateUserBody,
  UserListParams,
  UserSummary,
} from './user-role-token-types.js';

export type {
  CreateRedirectBody,
  IssueSeverity,
  Redirect,
  RedirectType,
  SeoIssue,
  SeoMeta,
  SeoScore,
  UpdateRedirectBody,
  UpsertSeoMetaBody,
} from './seo-types.js';

export type {
  AgentTokenCreated,
  AgentTokenSummary,
  AgentToolCallSummary,
  CreateAgentTokenBody,
} from './agent-token-types.js';

/* ── Users ───────────────────────────────────────────────── */

export interface UserSummary {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  isVerified: boolean;
  roles: string[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface UserListParams {
  role?: string;
  isActive?: boolean;
  limit?: number;
  cursor?: string;
}

export interface InviteUserBody {
  email: string;
  firstName?: string;
  lastName?: string;
  roleNames: string[];
  sendInvite?: boolean;
}

export interface UpdateUserBody {
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  roleNames?: string[];
}

/* ── Roles ───────────────────────────────────────────────── */

export interface Permission {
  id: string;
  resource: string;
  action: string;
  scope: string;
}

export interface RoleSummary {
  id: string;
  name: string;
  displayName: string;
  isSystem: boolean;
  usersCount: number;
  permissionsCount: number;
}

export interface RoleDetail {
  id: string;
  name: string;
  displayName: string;
  isSystem: boolean;
  permissions: Permission[];
}

export interface CreateRoleBody {
  name: string;
  displayName: string;
  description?: string;
}

export interface UpdateRoleBody {
  displayName?: string;
  description?: string;
}

export interface AssignPermissionsBody {
  permissions: Array<{ resource: string; action: string; scope?: string }>;
}

/* ── API Tokens ──────────────────────────────────────────── */

export type TokenScope = 'READ_ONLY' | 'FULL_ACCESS' | 'SCOPED';

export interface ApiTokenSummary {
  id: string;
  name: string;
  prefix: string;
  scope: TokenScope;
  scopeData?: Record<string, string[]>;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface ApiTokenCreated extends ApiTokenSummary {
  token: string;
}

export interface CreateApiTokenBody {
  name: string;
  scope: TokenScope;
  scopeData?: Record<string, string[]>;
  expiresAt?: string;
}

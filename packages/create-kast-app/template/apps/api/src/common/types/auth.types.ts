import type { TokenScope } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  isApiToken?: boolean;
  apiTokenId?: string;
  apiTokenScope?: TokenScope;
  apiTokenScopeData?: Record<string, string[]>;
  isAgentToken?: boolean;
  agentTokenId?: string;
  agentTokenName?: string;
  agentTokenScopes?: string[];
}

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  jti: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserSummary;
}

export interface MfaChallenge {
  mfaRequired: true;
  challengeToken: string;
  expiresIn: number;
  user: UserSummary;
}

export type LoginResult = TokenPair | MfaChallenge;

export interface UserSummary {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  roles: string[];
}

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

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  cursor: string | null;
  hasNextPage: boolean;
}

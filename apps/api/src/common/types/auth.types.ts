import type { TokenScope } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  sessionId?: string;
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
  sid?: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserSummary;
}

export interface UserSummary {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  roles: string[];
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

export interface TwoFactorChallenge {
  requiresTwoFactor: true;
  challengeToken: string;
}
export type LoginResult = TokenPair | TwoFactorChallenge;
export interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
}

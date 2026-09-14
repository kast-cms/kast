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
export interface TwoFactorChallenge {
  requiresTwoFactor: true;
  challengeToken: string;
}
export type LoginResult = TokenPair | TwoFactorChallenge;
export interface TwoFactorStatus {
  enabled: boolean;
  recoveryCodesRemaining: number;
}
export interface TwoFactorSetup {
  secret: string;
  otpauthUri: string;
  qrCode: string;
}
export interface RecoveryCodes {
  recoveryCodes: string[];
}
export interface AuthProviders {
  google: boolean;
  github: boolean;
  oidc: boolean;
}
export interface AuthSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  current: boolean;
}

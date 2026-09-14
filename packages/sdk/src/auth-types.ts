export type { LoginResult, TokenPair, MfaChallenge as TwoFactorChallenge } from './types.js';
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

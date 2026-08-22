/* eslint-disable max-lines, complexity */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHmac, randomBytes, randomUUID } from 'crypto';
import { SecretEncryptionService } from '../../common/security/secret-encryption.service';
import type {
  LoginResult,
  MfaChallenge,
  MfaSetup,
  MfaSetupVerified,
  MfaStatus,
  SessionSummary,
  TokenPair,
  UserSummary,
} from '../../common/types/auth.types';
import { QueueAdapter } from '../queue/queue.adapter';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { AuthRepository } from './auth.repository';
import type { LoginDto } from './dto/login.dto';
import type { SetupDto } from './dto/setup.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import {
  buildTotpUri,
  generateRecoveryCodes,
  generateTotpSecret,
  normalizeRecoveryCode,
  normalizeRecoveryCodeForVerification,
  verifyTotp,
} from './mfa-totp.util';
import { OAuthPolicy } from './oauth-policy';
import type { OAuthProfile } from './types/oauth.types';

/** An OAuth code only has to survive one provider→admin redirect hop. */
const OAUTH_CODE_TTL_MS = 60_000;
/** Generic OAuth/OIDC state only guards one provider round trip. */
const OAUTH_STATE_TTL_MS = 10 * 60_000;
/** A password-verified MFA challenge should only survive one prompt. */
const MFA_CHALLENGE_TTL_MS = 5 * 60_000;
const OPAQUE_TOKEN_LOOKUP_KEY = 'kast-opaque-token-lookup-v1';

export interface RequestMetadata {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  /**
   * Serialises setup attempts handled by this instance. PostgreSQL's default
   * READ COMMITTED isolation lets two concurrent transactions both observe an
   * empty users table, so the repository's in-transaction re-check does not on
   * its own exclude a second owner.
   */
  private setupChain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly queueAdapter: QueueAdapter,
    private readonly oauthPolicy: OAuthPolicy,
    private readonly secrets: SecretEncryptionService,
  ) {}

  /** True while the install has no users and the setup endpoint is still open. */
  async isSetupRequired(): Promise<boolean> {
    return (await this.authRepository.countUsers()) === 0;
  }

  /**
   * Creates the first owner account on a fresh install. Succeeds at most once:
   * the check and the insert run inside a critical section, and the repository
   * re-checks the user count inside its own transaction.
   */
  setup(dto: SetupDto): Promise<UserSummary> {
    return this.runSetupExclusively(async () => {
      if (!(await this.isSetupRequired())) {
        throw new ForbiddenException('Setup has already been completed');
      }

      const user = await this.authRepository.createInitialOwner({
        email: dto.email,
        passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }),
        firstName: dto.firstName,
        lastName: dto.lastName,
      });
      // The transaction returns null when another request won the race.
      if (!user) throw new ForbiddenException('Setup has already been completed');

      return this.toSummary(user, ['super_admin']);
    });
  }

  private runSetupExclusively<T>(work: () => Promise<T>): Promise<T> {
    const result = this.setupChain.then(work, work);
    // Swallow the outcome on the chain itself so one rejected attempt does not
    // reject every attempt queued behind it.
    this.setupChain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async login(dto: LoginDto, metadata: RequestMetadata = {}): Promise<LoginResult> {
    const user = await this.authRepository.findUserByEmail(dto.email);
    if (!user?.isActive) throw new UnauthorizedException('Invalid credentials');

    const valid = await argon2.verify(user.passwordHash ?? '', dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const roles = user.roles.map((ur) => ur.role.name);
    if (this.isMfaEnabled(user)) {
      return this.issueMfaChallenge(user, roles);
    }

    await this.authRepository.updateLastLogin(user.id);
    const [accessToken, refreshToken] = await Promise.all([
      this.issueAccessToken(user.id, user.email, roles),
      this.authRepository.createRefreshToken(user.id, this.refreshTokenExpiry(), metadata),
    ]);

    return { accessToken, refreshToken, expiresIn: 900, user: this.toSummary(user, roles) };
  }

  async refresh(raw: string, metadata: RequestMetadata = {}): Promise<TokenPair> {
    const record = await this.authRepository.findRefreshToken(raw);
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.authRepository.revokeRefreshToken(raw);

    const user = await this.authRepository.findUserById(record.userId);
    if (!user?.isActive) throw new UnauthorizedException('User not found or inactive');

    const roles = user.roles.map((ur) => ur.role.name);
    const [accessToken, refreshToken] = await Promise.all([
      this.issueAccessToken(user.id, user.email, roles),
      this.authRepository.createRefreshToken(user.id, this.refreshTokenExpiry(), metadata),
    ]);

    return { accessToken, refreshToken, expiresIn: 900, user: this.toSummary(user, roles) };
  }

  async logout(raw: string): Promise<void> {
    const record = await this.authRepository.findRefreshToken(raw);
    if (record && !record.revokedAt) {
      await this.authRepository.revokeRefreshToken(raw);
    }
  }

  async me(userId: string): Promise<UserSummary> {
    const user = await this.authRepository.findUserById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    return this.toSummary(
      user,
      user.roles.map((ur) => ur.role.name),
    );
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserSummary> {
    const user = await this.authRepository.findUserById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    // class-validator has already rejected any non-nullish newPassword shorter
    // than 8 characters, so a validated truthy value here is a real change
    // request — the branch below is the "only verify when changing" rule, not
    // a bypass a caller can shape.
    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException('currentPassword is required to change password');
      }
      const valid = await argon2.verify(user.passwordHash ?? '', dto.currentPassword);
      if (!valid) throw new BadRequestException('Current password is incorrect');
    }

    const data: Parameters<AuthRepository['updateUser']>[1] = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;
    if (dto.newPassword) data.passwordHash = await argon2.hash(dto.newPassword);

    const updated = await this.authRepository.updateUser(userId, data);
    if (dto.newPassword) await this.authRepository.revokeAllRefreshTokensForUser(userId);
    const roles = user.roles.map((ur) => ur.role.name);
    return this.toSummary({ ...user, ...updated }, roles);
  }

  async mfaStatus(userId: string): Promise<MfaStatus> {
    const user = await this.authRepository.findUserById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    return {
      enabled: this.isMfaEnabled(user),
      enabledAt: user.mfaEnabledAt?.toISOString() ?? null,
      recoveryCodeCount: user.mfaRecoveryCodes.length,
    };
  }

  async beginMfaSetup(userId: string): Promise<MfaSetup> {
    const user = await this.authRepository.findUserById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    const secret = generateTotpSecret();
    return { secret, otpauthUrl: buildTotpUri(secret, user.email) };
  }

  async verifyMfaSetup(userId: string, secret: string, code: string): Promise<MfaSetupVerified> {
    if (!verifyTotp(secret, code)) throw new BadRequestException('Invalid MFA code');
    const recoveryCodes = generateRecoveryCodes();
    await this.authRepository.updateMfa(userId, {
      mfaSecret: this.secrets.encrypt(secret),
      mfaEnabledAt: new Date(),
      mfaRecoveryCodes: await Promise.all(recoveryCodes.map((item) => this.hashRecoveryCode(item))),
    });
    return { enabled: true, recoveryCodes };
  }

  async disableMfa(userId: string, currentPassword: string, code: string): Promise<MfaStatus> {
    const user = await this.authRepository.findUserById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    const valid = await argon2.verify(user.passwordHash ?? '', currentPassword);
    if (!valid) throw new BadRequestException('Current password is incorrect');
    await this.verifyUserMfa(user, code);
    await this.authRepository.updateMfa(userId, {
      mfaSecret: null,
      mfaEnabledAt: null,
      mfaRecoveryCodes: [],
    });
    await this.authRepository.revokeAllRefreshTokensForUser(userId);
    return { enabled: false, enabledAt: null, recoveryCodeCount: 0 };
  }

  async regenerateRecoveryCodes(
    userId: string,
    code: string,
  ): Promise<{ recoveryCodes: string[] }> {
    const user = await this.authRepository.findUserById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    await this.verifyUserMfa(user, code);
    const recoveryCodes = generateRecoveryCodes();
    await this.authRepository.updateMfaRecoveryCodes(
      userId,
      await Promise.all(recoveryCodes.map((item) => this.hashRecoveryCode(item))),
    );
    return { recoveryCodes };
  }

  async completeMfaChallenge(
    challengeToken: string,
    code: string,
    metadata: RequestMetadata = {},
  ): Promise<TokenPair> {
    const userId = await this.consumeMfaChallenge(challengeToken);
    const user = await this.authRepository.findUserById(userId);
    if (!user?.isActive) throw new UnauthorizedException('User not found or inactive');
    await this.verifyUserMfa(user, code);
    await this.authRepository.updateLastLogin(user.id);
    return this.issueTokenPair(user, metadata);
  }

  async listSessions(userId: string): Promise<SessionSummary[]> {
    const rows = await this.authRepository.listActiveRefreshTokensForUser(userId);
    return rows.map((row) => ({
      id: row.id,
      userAgent: row.userAgent,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt.toISOString(),
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const revoked = await this.authRepository.revokeRefreshTokenByIdForUser(userId, sessionId);
    if (!revoked) throw new BadRequestException('Session not found or already revoked');
  }

  async revokeAllSessions(userId: string): Promise<{ revoked: number }> {
    const result = await this.authRepository.revokeAllRefreshTokensForUser(userId);
    return { revoked: result.count };
  }

  async oauthCallback(provider: string, profile: OAuthProfile): Promise<LoginResult> {
    const email = profile.emails?.[0]?.value ?? null;
    const user = await this.findOrCreateOAuthUser(provider, profile, email);
    if (!user.isActive) throw new UnauthorizedException('Account is inactive');
    await this.authRepository.upsertOAuthAccount(user.id, provider, profile.id, email);
    const roles = user.roles.map((ur) => ur.role.name);
    if (this.isMfaEnabled(user)) return this.issueMfaChallenge(user, roles);
    await this.authRepository.updateLastLogin(user.id);
    return this.issueTokenPair(user);
  }

  /**
   * Parks a freshly minted token pair behind an opaque single-use code. The
   * code is what travels through the browser redirect, so nothing long-lived
   * ends up in history, Referer headers or access logs.
   */
  async issueOAuthAuthorizationCode(tokenPair: LoginResult): Promise<string> {
    const code = randomBytes(32).toString('base64url');
    await this.queueAdapter.setEphemeral(
      `oauth-code:${this.hashOAuthCode(code)}`,
      JSON.stringify(tokenPair),
      OAUTH_CODE_TTL_MS,
    );
    return code;
  }

  async issueOAuthState(provider: string): Promise<string> {
    const state = randomBytes(32).toString('base64url');
    await this.queueAdapter.setEphemeral(
      `oauth-state:${this.hashOpaqueToken(state)}`,
      JSON.stringify({ provider }),
      OAUTH_STATE_TTL_MS,
    );
    return state;
  }

  async consumeOAuthState(provider: string, state: string): Promise<void> {
    const pending = await this.queueAdapter.consumeEphemeral(
      `oauth-state:${this.hashOpaqueToken(state)}`,
    );
    if (!pending) throw new UnauthorizedException('Invalid or expired OAuth state');
    try {
      const parsed = JSON.parse(pending) as { provider?: unknown };
      if (parsed.provider === provider) return;
    } catch {
      // Fall through to the uniform failure below.
    }
    throw new UnauthorizedException('Invalid or expired OAuth state');
  }

  async exchangeOAuthCode(code: string): Promise<LoginResult> {
    const key = this.hashOAuthCode(code);
    const pending = await this.queueAdapter.consumeEphemeral(`oauth-code:${key}`);
    if (!pending) {
      throw new UnauthorizedException('Invalid or expired authorization code');
    }
    try {
      return JSON.parse(pending) as TokenPair;
    } catch {
      throw new UnauthorizedException('Invalid or expired authorization code');
    }
  }

  /**
   * The code is 32 random bytes whose keyed digest is only the lookup key for a
   * 60-second ephemeral entry, so this must stay deterministic for exchange.
   */
  private hashOAuthCode(code: string): string {
    return this.hashOpaqueToken(code);
  }

  private async findOrCreateOAuthUser(
    provider: string,
    profile: OAuthProfile,
    email: string | null,
  ): Promise<User & { roles: { role: { name: string } }[] }> {
    const oauthAccount = await this.authRepository.findOAuthAccount(provider, profile.id);
    if (oauthAccount) {
      const existing = await this.authRepository.findUserById(oauthAccount.userId);
      if (existing) return existing;
    }
    return this.findOrCreateUserByEmail(profile, email);
  }

  private async findOrCreateUserByEmail(
    profile: OAuthProfile,
    email: string | null,
  ): Promise<User & { roles: { role: { name: string } }[] }> {
    if (!email) throw new UnauthorizedException('No email provided by OAuth provider');
    const verified = profile.emails?.[0]?.verified;
    const byEmail = await this.authRepository.findUserByEmail(email);
    // Linking a new provider identity to an existing local account is an
    // account-takeover boundary. An absent verification claim is not proof.
    if (byEmail) {
      if (verified !== true) {
        throw new UnauthorizedException('OAuth email address is not verified');
      }
      return byEmail;
    }
    // Past this point the identity is unknown to the install, so creating it is
    // self-registration and needs the operator's explicit policy, not a default.
    const decision = this.oauthPolicy.canProvision(email, verified);
    if (!decision.allowed) throw new ForbiddenException(decision.reason);
    const role = await this.authRepository.findDefaultRole();
    if (!role) throw new UnauthorizedException('No default role configured');
    const { firstName, lastName, avatarUrl } = this.extractProfileData(profile);
    return this.authRepository.createUser({
      email,
      firstName,
      lastName,
      avatarUrl,
      defaultRoleId: role.id,
    });
  }

  private extractProfileData(profile: OAuthProfile): {
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  } {
    return {
      firstName: profile.name?.givenName ?? null,
      lastName: profile.name?.familyName ?? null,
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };
  }

  private async issueTokenPair(
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      avatarUrl: string | null;
      roles: { role: { name: string } }[];
    },
    metadata: RequestMetadata = {},
  ): Promise<TokenPair> {
    const roles = user.roles.map((ur) => ur.role.name);
    const [accessToken, refreshToken] = await Promise.all([
      this.issueAccessToken(user.id, user.email, roles),
      this.authRepository.createRefreshToken(user.id, this.refreshTokenExpiry(), metadata),
    ]);
    return { accessToken, refreshToken, expiresIn: 900, user: this.toSummary(user, roles) };
  }

  private async issueMfaChallenge(
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      avatarUrl: string | null;
    },
    roles: string[],
  ): Promise<MfaChallenge> {
    const challengeToken = randomBytes(32).toString('base64url');
    await this.queueAdapter.setEphemeral(
      `mfa-challenge:${this.hashOpaqueToken(challengeToken)}`,
      JSON.stringify({ userId: user.id }),
      MFA_CHALLENGE_TTL_MS,
    );
    return {
      mfaRequired: true,
      challengeToken,
      expiresIn: Math.floor(MFA_CHALLENGE_TTL_MS / 1000),
      user: this.toSummary(user, roles),
    };
  }

  private async consumeMfaChallenge(challengeToken: string): Promise<string> {
    const pending = await this.queueAdapter.consumeEphemeral(
      `mfa-challenge:${this.hashOpaqueToken(challengeToken)}`,
    );
    if (!pending) throw new UnauthorizedException('Invalid or expired MFA challenge');
    try {
      const parsed = JSON.parse(pending) as { userId?: unknown };
      if (typeof parsed.userId === 'string') return parsed.userId;
    } catch {
      // Fall through to the uniform failure below.
    }
    throw new UnauthorizedException('Invalid or expired MFA challenge');
  }

  private isMfaEnabled(user: { mfaSecret?: string | null; mfaEnabledAt?: Date | null }): boolean {
    return Boolean(user.mfaSecret && user.mfaEnabledAt);
  }

  private async verifyUserMfa(
    user: {
      id: string;
      mfaSecret?: string | null;
      mfaRecoveryCodes?: string[];
    },
    code: string,
  ): Promise<void> {
    if (!user.mfaSecret) throw new UnauthorizedException('MFA is not enabled');
    if (verifyTotp(this.secrets.decrypt(user.mfaSecret), code)) return;

    const recoveryCode = normalizeRecoveryCodeForVerification(code);
    const recoveryCodeHashes = user.mfaRecoveryCodes ?? [];
    for (const hash of recoveryCodeHashes) {
      if (await argon2.verify(hash, recoveryCode)) {
        await this.authRepository.updateMfaRecoveryCodes(
          user.id,
          recoveryCodeHashes.filter((item) => item !== hash),
        );
        return;
      }
    }
    throw new UnauthorizedException('Invalid MFA code');
  }

  private hashRecoveryCode(code: string): Promise<string> {
    return argon2.hash(normalizeRecoveryCode(code), { type: argon2.argon2id });
  }

  private hashOpaqueToken(token: string): string {
    return createHmac('sha256', OPAQUE_TOKEN_LOOKUP_KEY).update(token).digest('hex');
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.authRepository.findUserByEmail(email);
    if (!user?.isActive) return; // no enumeration
    const { raw, hash } = this.authRepository.generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.authRepository.upsertPasswordResetToken(user.id, hash, expiresAt);
    await this.queueAdapter.enqueue(QUEUE_NAMES.EMAIL, 'password-reset', {
      to: user.email,
      token: raw,
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await this.consumeResetToken(token, newPassword, false, 'Invalid or expired reset token');
  }

  /**
   * Completes an invitation: the same single-use token, plus the verification
   * flag that separates an accepted invite from a pending one.
   */
  async acceptInvite(token: string, password: string): Promise<void> {
    await this.consumeResetToken(token, password, true, 'Invalid or expired invitation token');
  }

  private async consumeResetToken(
    token: string,
    newPassword: string,
    markVerified: boolean,
    failureMessage: string,
  ): Promise<void> {
    const { hash } = this.authRepository.generateHashOnly(token);
    // Hashed before the transaction opens: argon2 is deliberately slow and must
    // not hold the row lock that serialises concurrent redemptions.
    const passwordHash = await argon2.hash(newPassword);
    const userId = await this.authRepository.consumePasswordResetToken(hash, {
      passwordHash,
      markVerified,
    });
    if (!userId) throw new BadRequestException(failureMessage);
  }

  private async issueAccessToken(id: string, email: string, roles: string[]): Promise<string> {
    return this.jwtService.signAsync({ sub: id, email, roles, jti: randomUUID() });
  }

  private refreshTokenExpiry(): Date {
    // BR-AUT-002: refresh tokens expire in 30 days.
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d;
  }

  private toSummary(
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      avatarUrl: string | null;
    },
    roles: string[],
  ): UserSummary {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      roles,
    };
  }
}

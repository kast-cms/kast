import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'crypto';
import type { TokenPair, UserSummary } from '../../common/types/auth.types';
import { QueueAdapter } from '../queue/queue.adapter';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { AuthRepository } from './auth.repository';
import type { LoginDto } from './dto/login.dto';
import type { SetupDto } from './dto/setup.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import { OAuthPolicy } from './oauth-policy';
import type { OAuthProfile } from './types/oauth.types';

/** An OAuth code only has to survive one provider→admin redirect hop. */
const OAUTH_CODE_TTL_MS = 60_000;

interface PendingOAuthCode {
  tokenPair: TokenPair;
  expiresAt: number;
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

  /**
   * Pending OAuth authorization codes, keyed by SHA-256 of the code so a heap
   * dump never yields a redeemable value. Held in this process: a horizontally
   * scaled API must pin the OAuth callback and the exchange to one instance
   * (sticky sessions) until these move to shared storage.
   */
  private readonly oauthCodes = new Map<string, PendingOAuthCode>();

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly queueAdapter: QueueAdapter,
    private readonly oauthPolicy: OAuthPolicy,
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

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.authRepository.findUserByEmail(dto.email);
    if (!user?.isActive) throw new UnauthorizedException('Invalid credentials');

    const valid = await argon2.verify(user.passwordHash ?? '', dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.authRepository.updateLastLogin(user.id);
    const roles = user.roles.map((ur) => ur.role.name);
    const [accessToken, refreshToken] = await Promise.all([
      this.issueAccessToken(user.id, user.email, roles),
      this.authRepository.createRefreshToken(user.id, this.refreshTokenExpiry()),
    ]);

    return { accessToken, refreshToken, expiresIn: 900, user: this.toSummary(user, roles) };
  }

  async refresh(raw: string): Promise<TokenPair> {
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
      this.authRepository.createRefreshToken(user.id, this.refreshTokenExpiry()),
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
    const roles = user.roles.map((ur) => ur.role.name);
    return this.toSummary({ ...user, ...updated }, roles);
  }

  async oauthCallback(provider: string, profile: OAuthProfile): Promise<TokenPair> {
    const email = profile.emails?.[0]?.value ?? null;
    const user = await this.findOrCreateOAuthUser(provider, profile, email);
    if (!user.isActive) throw new UnauthorizedException('Account is inactive');
    await this.authRepository.upsertOAuthAccount(user.id, provider, profile.id, email);
    await this.authRepository.updateLastLogin(user.id);
    return this.issueTokenPair(user);
  }

  /**
   * Parks a freshly minted token pair behind an opaque single-use code. The
   * code is what travels through the browser redirect, so nothing long-lived
   * ends up in history, Referer headers or access logs.
   */
  issueOAuthAuthorizationCode(tokenPair: TokenPair): string {
    this.purgeExpiredOAuthCodes();
    const code = randomBytes(32).toString('base64url');
    this.oauthCodes.set(this.hashOAuthCode(code), {
      tokenPair,
      expiresAt: Date.now() + OAUTH_CODE_TTL_MS,
    });
    return code;
  }

  async exchangeOAuthCode(code: string): Promise<TokenPair> {
    const key = this.hashOAuthCode(code);
    const pending = this.oauthCodes.get(key);
    // Consumed even when expired, so a replay never sees the same code twice.
    this.oauthCodes.delete(key);
    this.purgeExpiredOAuthCodes();
    if (!pending || pending.expiresAt <= Date.now()) {
      throw new UnauthorizedException('Invalid or expired authorization code');
    }
    return pending.tokenPair;
  }

  private hashOAuthCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private purgeExpiredOAuthCodes(): void {
    const now = Date.now();
    for (const [key, pending] of this.oauthCodes) {
      if (pending.expiresAt <= now) this.oauthCodes.delete(key);
    }
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
    // The email is about to be used as an identity claim — matching an existing
    // account or minting a new one — so a provider that tells us it is
    // unverified must not be taken at its word.
    if (profile.emails?.[0]?.verified === false) {
      throw new UnauthorizedException('OAuth email address is not verified');
    }
    const byEmail = await this.authRepository.findUserByEmail(email);
    if (byEmail) return byEmail;
    // Past this point the identity is unknown to the install, so creating it is
    // self-registration and needs the operator's explicit policy, not a default.
    const decision = this.oauthPolicy.canProvision(email, profile.emails?.[0]?.verified);
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

  private async issueTokenPair(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
    roles: { role: { name: string } }[];
  }): Promise<TokenPair> {
    const roles = user.roles.map((ur) => ur.role.name);
    const [accessToken, refreshToken] = await Promise.all([
      this.issueAccessToken(user.id, user.email, roles),
      this.authRepository.createRefreshToken(user.id, this.refreshTokenExpiry()),
    ]);
    return { accessToken, refreshToken, expiresIn: 900, user: this.toSummary(user, roles) };
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

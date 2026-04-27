import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import type { TokenPair, UserSummary } from '../../common/types/auth.types';
import { QueueAdapter } from '../queue/queue.adapter';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { AuthRepository } from './auth.repository';
import type { LoginDto } from './dto/login.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { OAuthProfile } from './types/oauth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly queueAdapter: QueueAdapter,
  ) {}

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
    const byEmail = await this.authRepository.findUserByEmail(email);
    if (byEmail) return byEmail;
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
    const { hash } = this.authRepository.generateHashOnly(token);
    const record = await this.authRepository.findPasswordResetToken(hash);
    if (!record) throw new BadRequestException('Invalid or expired reset token');
    await Promise.all([
      this.authRepository.markPasswordResetTokenUsed(record.id),
      this.authRepository.revokeAllRefreshTokensForUser(record.userId),
      this.authRepository.updateUser(record.userId, {
        passwordHash: await argon2.hash(newPassword),
      }),
    ]);
  }

  private async issueAccessToken(id: string, email: string, roles: string[]): Promise<string> {
    return this.jwtService.signAsync({ sub: id, email, roles, jti: randomUUID() });
  }

  private refreshTokenExpiry(): Date {
    const d = new Date();
    d.setDate(d.getDate() + 7);
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

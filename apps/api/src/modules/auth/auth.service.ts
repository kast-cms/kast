import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import type { TokenPair, UserSummary } from '../../common/types/auth.types';
import { AuthRepository } from './auth.repository';
import type { LoginDto } from './dto/login.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
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

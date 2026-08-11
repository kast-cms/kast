import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport';
import type { AuthUser } from '../../../common/types/auth.types';
import { AuthRepository } from '../auth.repository';

@Injectable()
export class ApiTokenStrategy extends PassportStrategy(Strategy, 'api-token') {
  constructor(private readonly authRepository: AuthRepository) {
    super({ passReqToCallback: true });
  }

  override async authenticate(req: Request): Promise<void> {
    const self = this as unknown as {
      fail(info: object, status: number): void;
      success(user: unknown): void;
    };
    try {
      const user = await this.extractAndValidate(req);
      if (!user) {
        self.fail({ message: 'No api token' }, 401);
        return;
      }
      self.success(user);
    } catch {
      self.fail({ message: 'Invalid api token' }, 401);
    }
  }

  private extractRaw(req: Request): string | null {
    const headerKey = req.headers['x-kast-key'];
    if (typeof headerKey === 'string' && headerKey.length > 0) return headerKey;

    const auth = req.headers['authorization'];
    if (typeof auth === 'string' && auth.startsWith('Bearer kast_')) return auth.slice(7);

    return null;
  }

  private async extractAndValidate(req: Request): Promise<AuthUser | null> {
    const rawToken = this.extractRaw(req);
    if (!rawToken) return null;

    const record = await this.authRepository.findApiToken(rawToken);
    if (!record?.user.isActive) {
      throw new UnauthorizedException('Invalid API token');
    }
    if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid API token');
    }

    this.authRepository.updateApiTokenLastUsed(record.id);

    const scopeData = this.extractScopeData(record.scopeData);
    return {
      id: record.user.id,
      email: record.user.email,
      roles: record.user.roles.map((ur) => ur.role.name),
      isApiToken: true,
      apiTokenId: record.id,
      apiTokenScope: record.scope,
      ...(scopeData ? { apiTokenScopeData: scopeData } : {}),
    };
  }

  private extractScopeData(value: unknown): Record<string, string[]> | undefined {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, string[]>;
    }
    return undefined;
  }
}

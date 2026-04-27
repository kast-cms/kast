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

  private async extractAndValidate(req: Request): Promise<AuthUser | null> {
    const headerKey = req.headers['x-kast-key'];
    let rawToken: string | undefined;

    if (typeof headerKey === 'string' && headerKey.length > 0) {
      rawToken = headerKey;
    } else {
      const auth = req.headers['authorization'];
      if (typeof auth === 'string' && auth.startsWith('Bearer kast_')) {
        rawToken = auth.slice(7);
      }
    }

    if (!rawToken) return null;

    const record = await this.authRepository.findApiToken(rawToken);
    if (!record?.user.isActive) {
      throw new UnauthorizedException('Invalid API token');
    }

    return {
      id: record.user.id,
      email: record.user.email,
      roles: record.user.roles.map((ur) => ur.role.name),
      isApiToken: true,
      apiTokenId: record.id,
    };
  }
}

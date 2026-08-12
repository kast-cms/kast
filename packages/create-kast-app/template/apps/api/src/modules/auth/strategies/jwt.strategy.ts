import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthUser, JwtPayload } from '../../../common/types/auth.types';
import type { Env } from '../../../config/env.schema';
import { AuthRepository } from '../auth.repository';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService<Env>,
    private readonly authRepository: AuthRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET', { infer: true }),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    // A signed JWT proves that this account authenticated in the past; it does
    // not prove that the account is still active or still holds the roles in
    // its embedded claims. Resolve both from the database on every request so
    // deactivation and role revocation take effect immediately rather than at
    // access-token expiry.
    const user = await this.authRepository.findUserById(payload.sub);
    if (!user?.isActive || user.trashedAt) {
      throw new UnauthorizedException('User account is inactive');
    }

    return {
      id: user.id,
      email: user.email,
      roles: user.roles.map(({ role }) => role.name),
    };
  }
}

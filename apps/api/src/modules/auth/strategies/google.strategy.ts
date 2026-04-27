import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import type { Env } from '../../../config/env.schema';
import { AuthService } from '../auth.service';
import type { OAuthProfile } from '../types/oauth.types';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService<Env>,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get('GOOGLE_CLIENT_ID', { infer: true }) ?? 'placeholder',
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET', { infer: true }) ?? 'placeholder',
      callbackURL: `${configService.get('SITE_URL', { infer: true })}/api/v1/auth/oauth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: OAuthProfile,
  ): ReturnType<AuthService['oauthCallback']> {
    return this.authService.oauthCallback('google', profile);
  }
}

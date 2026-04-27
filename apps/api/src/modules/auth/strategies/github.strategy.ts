import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import type { Env } from '../../../config/env.schema';
import { AuthService } from '../auth.service';
import type { OAuthProfile } from '../types/oauth.types';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    configService: ConfigService<Env>,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get('GITHUB_CLIENT_ID', { infer: true }) ?? 'placeholder',
      clientSecret: configService.get('GITHUB_CLIENT_SECRET', { infer: true }) ?? 'placeholder',
      callbackURL: `${configService.get('SITE_URL', { infer: true })}/api/v1/auth/oauth/github/callback`,
      scope: ['user:email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: OAuthProfile,
  ): ReturnType<AuthService['oauthCallback']> {
    return this.authService.oauthCallback('github', profile);
  }
}

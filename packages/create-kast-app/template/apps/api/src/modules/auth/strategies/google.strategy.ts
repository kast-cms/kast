import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-google-oauth20';
import type { Env } from '../../../config/env.schema';
import { QueueAdapter } from '../../queue/queue.adapter';
import { AuthService } from '../auth.service';
import { OAuthStateStore } from '../oauth-state.store';
import { requestMetadata } from '../request-metadata';
import type { OAuthProfile } from '../types/oauth.types';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService<Env>,
    private readonly authService: AuthService,
    queue: QueueAdapter,
  ) {
    super({
      clientID: configService.get('GOOGLE_CLIENT_ID', { infer: true }) ?? 'placeholder',
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET', { infer: true }) ?? 'placeholder',
      callbackURL: `${configService.get('SITE_URL', { infer: true })}/api/v1/auth/oauth/google/callback`,
      scope: ['email', 'profile'],
      state: true,
      passReqToCallback: true,
      store: new OAuthStateStore(
        queue,
        'google',
        (configService.get('SITE_URL', { infer: true }) ?? '').startsWith('https:'),
      ),
    });
  }

  async validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: OAuthProfile,
  ): ReturnType<AuthService['oauthCallback']> {
    return this.authService.oauthCallback('google', profile, requestMetadata(req));
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import type { Env } from '../../../config/env.schema';
import { AuthService } from '../auth.service';
import type { OAuthProfile } from '../types/oauth.types';

interface GitHubEmail {
  email: string;
  verified: boolean;
}

function isGitHubEmail(value: unknown): value is GitHubEmail {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.email === 'string' && typeof record.verified === 'boolean';
}

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
      state: true,
    });
  }

  async validate(
    accessToken: string,
    _refreshToken: string,
    profile: OAuthProfile,
  ): ReturnType<AuthService['oauthCallback']> {
    const selectedEmail = profile.emails?.[0];
    if (selectedEmail && selectedEmail.verified === undefined) {
      selectedEmail.verified = await this.isVerifiedGitHubEmail(accessToken, selectedEmail.value);
    }
    return this.authService.oauthCallback('github', profile);
  }

  private async isVerifiedGitHubEmail(accessToken: string, selected: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.github.com/user/emails', {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'kast-cms',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      if (!response.ok) return false;
      const emails: unknown = await response.json();
      if (!Array.isArray(emails)) return false;
      return emails.some((item: unknown) =>
        isGitHubEmail(item) ? item.email === selected && item.verified : false,
      );
    } catch {
      return false;
    }
  }
}

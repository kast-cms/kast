import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import * as oidc from 'openid-client';
import type { Env } from '../../config/env.schema';
import { QueueAdapter } from '../queue/queue.adapter';
import type { OAuthProfile } from './types/oauth.types';

@Injectable()
export class OidcService {
  private configuration: Promise<oidc.Configuration> | undefined;
  constructor(
    private readonly env: ConfigService<Env>,
    private readonly queue: QueueAdapter,
  ) {}

  enabled(): boolean {
    return Boolean(
      this.env.get('OIDC_ISSUER_URL') &&
      this.env.get('OIDC_CLIENT_ID') &&
      this.env.get('OIDC_CLIENT_SECRET'),
    );
  }

  callbackUrl(): string {
    return `${this.env.get('SITE_URL', { infer: true })?.replace(/\/+$/, '')}/api/v1/auth/oauth/oidc/callback`;
  }

  private config(): Promise<oidc.Configuration> {
    if (!this.enabled()) throw new ServiceUnavailableException('OIDC is not configured');
    this.configuration ??= oidc
      .discovery(
        new URL(this.env.get('OIDC_ISSUER_URL', { infer: true }) ?? ''),
        this.env.get('OIDC_CLIENT_ID', { infer: true }) ?? '',
        this.env.get('OIDC_CLIENT_SECRET', { infer: true }) ?? '',
        undefined,
        { execute: [oidc.enableNonRepudiationChecks] },
      )
      .catch((error: unknown) => {
        this.configuration = undefined;
        throw error;
      });
    return this.configuration;
  }

  async start(): Promise<{ state: string; url: string }> {
    const config = await this.config();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const verifier = oidc.randomPKCECodeVerifier();
    const url = oidc.buildAuthorizationUrl(config, {
      redirect_uri: this.callbackUrl(),
      response_type: 'code',
      scope: this.env.get('OIDC_SCOPES', { infer: true }) ?? 'openid email profile',
      state,
      nonce,
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
      code_challenge_method: 'S256',
    });
    await this.queue.setEphemeral(this.key(state), JSON.stringify({ nonce, verifier }), 300_000);
    return { state, url: url.toString() };
  }

  async callback(url: URL, browserState: string | undefined): Promise<OAuthProfile> {
    if (
      !browserState ||
      !/^[a-zA-Z0-9_-]{43}$/.test(browserState) ||
      url.searchParams.get('state') !== browserState
    )
      throw new UnauthorizedException('Invalid OIDC state');
    const stored = await this.queue.consumeEphemeral(this.key(browserState));
    if (!stored) throw new UnauthorizedException('OIDC request expired or already used');
    try {
      const { nonce, verifier } = JSON.parse(stored) as { nonce: string; verifier: string };
      const tokens = await oidc.authorizationCodeGrant(await this.config(), url, {
        pkceCodeVerifier: verifier,
        expectedState: browserState,
        expectedNonce: nonce,
        idTokenExpected: true,
      });
      const claims = tokens.claims();
      if (!claims?.sub) throw new Error('Missing subject');
      return oidcProfile(claims);
    } catch {
      throw new UnauthorizedException('OIDC authentication failed');
    }
  }

  providerKey(): string {
    // Subjects are unique within an issuer, not across providers.
    return `oidc:${this.env.get('OIDC_ISSUER_URL', { infer: true })}`;
  }

  private key(state: string): string {
    return `oidc:${createHash('sha256').update(state).digest('hex')}`;
  }
}

function oidcProfile(claims: Record<string, unknown> & { sub: string }): OAuthProfile {
  return {
    id: claims.sub,
    provider: 'oidc',
    ...(typeof claims.email === 'string'
      ? { emails: [{ value: claims.email, verified: claims.email_verified === true }] }
      : {}),
    name: {
      ...(typeof claims.given_name === 'string' ? { givenName: claims.given_name } : {}),
      ...(typeof claims.family_name === 'string' ? { familyName: claims.family_name } : {}),
    },
  };
}

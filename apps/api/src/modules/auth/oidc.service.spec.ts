import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { generateKeyPairSync } from 'crypto';
import { sign } from 'jsonwebtoken';
import type { Env } from '../../config/env.schema';
import type { QueueAdapter } from '../queue/queue.adapter';
import { OidcService } from './oidc.service';

const issuer = 'https://issuer.example';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', use: 'sig', alg: 'RS256' };

describe('OIDC verified authorization code flow', () => {
  let service: OidcService;
  let nonce: string;
  let claims: Record<string, unknown>;
  let exchangeBody: string;
  let invalidSignature: boolean;
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    claims = {};
    exchangeBody = '';
    invalidSignature = false;
    const env: Record<string, string> = {
      OIDC_ISSUER_URL: issuer,
      OIDC_CLIENT_ID: 'kast-test',
      OIDC_CLIENT_SECRET: 'client-secret',
      SITE_URL: 'https://api.example',
      OIDC_SCOPES: 'openid email profile',
    };
    const queue = {
      setEphemeral: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      consumeEphemeral: jest.fn(async (key: string) => {
        const value = store.get(key);
        store.delete(key);
        return value ?? null;
      }),
    } as unknown as QueueAdapter;
    service = new OidcService({ get: (name: string) => env[name] } as ConfigService<Env>, queue);
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/.well-known/openid-configuration'))
        return Response.json({
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          jwks_uri: `${issuer}/jwks`,
          response_types_supported: ['code'],
          subject_types_supported: ['public'],
          id_token_signing_alg_values_supported: ['RS256'],
        });
      if (url.endsWith('/jwks')) return Response.json({ keys: [jwk] });
      if (url.endsWith('/token')) {
        exchangeBody = String(init?.body);
        const key = invalidSignature
          ? generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey
          : privateKey;
        const idToken = sign(
          {
            iss: issuer,
            aud: 'kast-test',
            sub: 'subject-1',
            nonce,
            email: 'owner@example.com',
            email_verified: true,
            ...claims,
          },
          key,
          { algorithm: 'RS256', keyid: 'test-key', expiresIn: '5m' },
        );
        return Response.json({
          access_token: 'provider-token',
          token_type: 'Bearer',
          id_token: idToken,
        });
      }
      throw new Error(`Unexpected OIDC request: ${url}`);
    });
  });
  afterEach(() => jest.restoreAllMocks());

  async function callbackUrl(): Promise<{ url: URL; state: string }> {
    const started = await service.start();
    const authorize = new URL(started.url);
    nonce = authorize.searchParams.get('nonce') ?? '';
    expect(authorize.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorize.searchParams.get('code_challenge')).toHaveLength(43);
    const url = new URL(service.callbackUrl());
    url.searchParams.set('state', started.state);
    url.searchParams.set('code', 'code-1');
    return { url, state: started.state };
  }

  it('validates a signed ID token and exchanges using PKCE, then rejects replay', async () => {
    const { url, state } = await callbackUrl();
    await expect(service.callback(url, state)).resolves.toMatchObject({
      id: 'subject-1',
      emails: [{ value: 'owner@example.com', verified: true }],
    });
    expect(new URLSearchParams(exchangeBody).get('code_verifier')).toHaveLength(43);
    await expect(service.callback(url, state)).rejects.toThrow(UnauthorizedException);
  });
  it.each([{ nonce: 'wrong' }, { iss: 'https://attacker.example' }, { aud: 'other-client' }])(
    'rejects invalid ID token claims %j',
    async (overrides) => {
      const { url, state } = await callbackUrl();
      claims = overrides;
      await expect(service.callback(url, state)).rejects.toThrow(UnauthorizedException);
    },
  );
  it('rejects an invalid signature', async () => {
    const { url, state } = await callbackUrl();
    invalidSignature = true;
    await expect(service.callback(url, state)).rejects.toThrow(UnauthorizedException);
  });
  it('rejects callbacks without matching browser state before exchanging', async () => {
    const { url } = await callbackUrl();
    await expect(service.callback(url, undefined)).rejects.toThrow(UnauthorizedException);
    await expect(service.callback(url, 'x'.repeat(43))).rejects.toThrow(UnauthorizedException);
    expect(exchangeBody).toBe('');
  });
});

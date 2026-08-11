import type { ConfigService } from '@nestjs/config';
import { OAuthPolicy } from './oauth-policy';

function buildPolicy(env: Record<string, string>): OAuthPolicy {
  const config = {
    get: jest.fn((key: string) => env[key]),
  } as unknown as ConfigService;
  return new OAuthPolicy(config);
}

describe('OAuthPolicy', () => {
  describe('default installation', () => {
    it('refuses to provision anyone when nothing is configured', () => {
      const policy = buildPolicy({});
      expect(policy.canProvision('someone@kast.local', true).allowed).toBe(false);
    });

    it('refuses an unrecognised mode rather than guessing an open one', () => {
      const policy = buildPolicy({ OAUTH_SIGNUP_MODE: 'OPEN-ish' });
      expect(policy.canProvision('someone@kast.local', true).allowed).toBe(false);
    });
  });

  describe('open mode', () => {
    it('provisions a verified email from any domain', () => {
      const policy = buildPolicy({ OAUTH_SIGNUP_MODE: 'open' });
      expect(policy.canProvision('anyone@anywhere.test', true).allowed).toBe(true);
    });

    it('refuses an email the provider did not confirm as verified', () => {
      const policy = buildPolicy({ OAUTH_SIGNUP_MODE: 'open' });
      expect(policy.canProvision('anyone@anywhere.test', undefined).allowed).toBe(false);
      expect(policy.canProvision('anyone@anywhere.test', false).allowed).toBe(false);
    });

    it('accepts an unverified claim only once the install waives the requirement', () => {
      const policy = buildPolicy({
        OAUTH_SIGNUP_MODE: 'open',
        OAUTH_SIGNUP_REQUIRE_VERIFIED: 'false',
      });
      expect(policy.canProvision('anyone@anywhere.test', undefined).allowed).toBe(true);
    });
  });

  describe('allowlist mode', () => {
    const env = {
      OAUTH_SIGNUP_MODE: 'allowlist',
      OAUTH_SIGNUP_ALLOWED_DOMAINS: ' Kast.local , @example.com ',
    };

    it('provisions a listed domain, case-insensitively and ignoring a leading @', () => {
      const policy = buildPolicy(env);
      expect(policy.canProvision('someone@KAST.local', true).allowed).toBe(true);
      expect(policy.canProvision('someone@example.com', true).allowed).toBe(true);
    });

    it('refuses a domain that is not listed', () => {
      const policy = buildPolicy(env);
      expect(policy.canProvision('attacker@evil.test', true).allowed).toBe(false);
    });

    it('refuses a lookalike that only ends with a listed domain', () => {
      const policy = buildPolicy(env);
      expect(policy.canProvision('attacker@notexample.com', true).allowed).toBe(false);
    });

    it('refuses everything when the allowlist is empty', () => {
      const policy = buildPolicy({ OAUTH_SIGNUP_MODE: 'allowlist' });
      expect(policy.canProvision('someone@kast.local', true).allowed).toBe(false);
    });
  });
});

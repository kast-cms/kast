import { generateSync } from 'otplib';
import { TotpService, parseRecoveryHashes } from './totp.service';

const config = { get: () => 'Kast CMS' } as never;

function buildService(): TotpService {
  return new TotpService(config);
}

describe('TotpService', () => {
  it('generates scannable otpauth URIs carrying issuer, account and secret', () => {
    const svc = buildService();
    const secret = svc.generateSecret();
    const uri = svc.buildOtpauthUri(secret, 'owner@example.com');
    expect(uri).toMatch(/^otpauth:\/\/totp\/Kast%20CMS:owner%40example\.com\?/);
    expect(uri).toContain(`secret=${secret}`);
  });

  it('accepts a current code and reports its timestep', () => {
    const svc = buildService();
    const secret = svc.generateSecret();
    const token = generateSync({ secret });
    const verdict = svc.verifyTotp(token, secret, null);
    expect(verdict).toEqual({ ok: true, timeStep: expect.any(Number) });
  });

  it('rejects a code from a timestep at or before the stored counter', () => {
    const svc = buildService();
    const secret = svc.generateSecret();
    const token = generateSync({ secret });
    const first = svc.verifyTotp(token, secret, null);
    if (!first.ok) throw new Error('precondition: first verification passes');
    // The same code replayed against the counter it just advanced to.
    expect(svc.verifyTotp(token, secret, first.timeStep)).toEqual({ ok: false });
    expect(svc.verifyTotp(token, secret, first.timeStep + 1)).toEqual({ ok: false });
  });

  it('rejects malformed codes without consulting the verifier', () => {
    const svc = buildService();
    const secret = svc.generateSecret();
    expect(svc.verifyTotp('12345', secret, null)).toEqual({ ok: false });
    expect(svc.verifyTotp('abcdef', secret, null)).toEqual({ ok: false });
    // Recovery-code shape must never be interpreted as TOTP.
    expect(svc.verifyTotp('aaaaaaaaaaaa', secret, null)).toEqual({ ok: false });
  });

  it('issues the documented number of unique recovery codes', () => {
    const svc = buildService();
    const { raw, hashes } = svc.generateRecoveryCodes();
    expect(raw).toHaveLength(10);
    expect(new Set(raw).size).toBe(10);
    expect(hashes).toHaveLength(10);
    expect(raw.every((code) => !hashes.includes(code))).toBe(true);
  });

  it('matches a recovery code to its stored hash index only', () => {
    const svc = buildService();
    const { raw, hashes } = svc.generateRecoveryCodes();
    expect(svc.verifyRecoveryCode(raw[3] ?? '', hashes)).toBe(3);
    expect(svc.verifyRecoveryCode('not-a-code', hashes)).toBeNull();
  });

  it('parses stored recovery hashes and fails closed on garbage', () => {
    expect(parseRecoveryHashes(null)).toEqual([]);
    expect(parseRecoveryHashes('["abc", "def"]')).toEqual(['abc', 'def']);
    expect(() => parseRecoveryHashes('not json')).toThrow();
    expect(() => parseRecoveryHashes('["ok", 42]')).toThrow();
  });
});

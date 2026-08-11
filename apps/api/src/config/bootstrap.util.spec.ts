import { originOf, parseTrustProxy } from './bootstrap.util';

describe('parseTrustProxy (FORM-07)', () => {
  it('defaults to not trusting a forwarded header', () => {
    // The unset case: an untrusted X-Forwarded-For would let any caller forge
    // the IP stored against its submission and mint a fresh throttler bucket.
    expect(parseTrustProxy('')).toBe(false);
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('  FALSE  ')).toBe(false);
  });

  it('reads a bare integer as a hop count, not a hostname', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('2')).toBe(2);
  });

  it('passes an address, CIDR or preset through to Express', () => {
    expect(parseTrustProxy('loopback')).toBe('loopback');
    expect(parseTrustProxy('10.0.0.0/8')).toBe('10.0.0.0/8');
  });

  it('accepts an explicit true', () => {
    expect(parseTrustProxy('true')).toBe(true);
  });
});

describe('originOf (ADMIN_URL base path)', () => {
  it('strips the admin base path, which frame-ancestors would ignore anyway', () => {
    expect(originOf('http://localhost:3001/admin')).toBe('http://localhost:3001');
  });

  it('keeps a non-default port', () => {
    expect(originOf('https://cms.example.com:8443/admin/')).toBe('https://cms.example.com:8443');
  });

  it('leaves an unparseable value alone rather than dropping the directive', () => {
    expect(originOf('not a url')).toBe('not a url');
  });
});

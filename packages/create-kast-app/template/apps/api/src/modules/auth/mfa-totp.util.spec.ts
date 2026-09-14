import { normalizeRecoveryCodeForVerification, verifyTotp } from './mfa-totp.util';

describe('mfa-totp.util', () => {
  it('verifies TOTP secrets with base32 padding', () => {
    expect(verifyTotp('JBSWY3DPEHPK3PXP====', '602287', new Date(60_000))).toBe(true);
  });

  it('normalizes only valid recovery code candidates for verification', () => {
    expect(normalizeRecoveryCodeForVerification('abcd-1234-ef56')).toBe('ABCD1234EF56');
    expect(normalizeRecoveryCodeForVerification('not-a-recovery-code')).not.toBe(
      'NOTARECOVERYCODE',
    );
  });
});

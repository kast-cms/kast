import { decryptSecret, encryptSecret } from './secret-crypto.util';

describe('secret-crypto', () => {
  const appSecret = 'test-app-secret-0123456789';

  it('round-trips a secret', () => {
    const plain = 'whsec_abcdef123456';
    const enc = encryptSecret(plain, appSecret);
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(enc).not.toContain(plain);
    expect(decryptSecret(enc, appSecret)).toBe(plain);
  });

  it('returns legacy plaintext values verbatim', () => {
    expect(decryptSecret('legacy-plaintext-secret', appSecret)).toBe('legacy-plaintext-secret');
  });

  it('produces different ciphertext each time (random IV)', () => {
    const a = encryptSecret('same', appSecret);
    const b = encryptSecret('same', appSecret);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, appSecret)).toBe('same');
    expect(decryptSecret(b, appSecret)).toBe('same');
  });
});

import { createHash, randomBytes } from 'crypto';

/**
 * Single-use credentials that arrive by email — password resets and
 * invitations — share one storage shape: only the digest is persisted, so a
 * database dump never yields a usable link.
 */
export function hashResetToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function generateResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('hex');
  return { raw, hash: hashResetToken(raw) };
}

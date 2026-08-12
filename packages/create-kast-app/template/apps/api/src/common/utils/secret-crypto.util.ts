import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Reversible AES-256-GCM encryption for secrets that must be recovered later
 * (e.g. webhook HMAC signing keys). The key is derived from an app secret so no
 * extra config is required; ciphertext is stored as `enc:v1:<iv>:<tag>:<data>`
 * (all base64). Values without the `enc:` prefix are returned verbatim so legacy
 * plaintext rows keep working until they are re-saved.
 */
const PREFIX = 'enc:v1:';
const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(PREFIX);
}

function deriveKey(appSecret: string): Buffer {
  return createHash('sha256').update(`kast:secret:${appSecret}`).digest();
}

export function encryptSecret(plaintext: string, appSecret: string): string {
  const key = deriveKey(appSecret);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptSecret(stored: string, appSecret: string): string {
  if (!stored.startsWith(PREFIX)) {
    // Legacy/plaintext value — return as-is so existing webhooks still sign.
    return stored;
  }
  const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed encrypted secret');
  }
  const key = deriveKey(appSecret);
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

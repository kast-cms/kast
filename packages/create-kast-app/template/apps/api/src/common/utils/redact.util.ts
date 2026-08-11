import { isSecretSettingKey } from './secret-key.util';

/**
 * Fields whose values must never be written to the audit log in cleartext.
 * Matched case-insensitively against object keys.
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'currentpassword',
  'newpassword',
  'tokenhash',
  'token',
  'secret',
  'secrethash',
  'accesstoken',
  'refreshtoken',
]);

const REDACTED = '***REDACTED***';

/**
 * True for a `{ key, value }` pair whose `key` names a credential.
 *
 * The settings PATCH body is `{ settings: [{ key: 'smtp.password', value: '<plaintext>' }] }`,
 * so key-name matching alone never fires — the object key is the literal
 * string `value`. Without this rule the audit log stores SMTP credentials in
 * cleartext even though the API response no longer echoes them.
 */
function isSecretKeyValuePair(value: Record<string, unknown>): boolean {
  return typeof value['key'] === 'string' && 'value' in value && isSecretSettingKey(value['key']);
}

/**
 * Returns a deep copy of `value` with any sensitive fields replaced by a
 * redaction marker. Safe for arbitrary JSON-like structures; cycles are
 * not expected on request/response payloads but are guarded against via depth.
 */
export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1));
  }
  if (typeof value === 'object') {
    return redactObject(value as Record<string, unknown>, depth);
  }
  return value;
}

function redactObject(record: Record<string, unknown>, depth: number): Record<string, unknown> {
  const secretPair = isSecretKeyValuePair(record);
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(record)) {
    const redactThis = SENSITIVE_KEYS.has(key.toLowerCase()) || (secretPair && key === 'value');
    out[key] = redactThis ? REDACTED : redactSensitive(val, depth + 1);
  }
  return out;
}

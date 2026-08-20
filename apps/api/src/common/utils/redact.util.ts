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
  'apikey',
  'accesskey',
  'clientsecret',
  'passphrase',
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
  // The copy is rebuilt with Object.fromEntries — CreateDataProperty semantics,
  // so a JSON `__proto__` key lands as a plain own property instead of reaching
  // an assignment that would mutate the copy's prototype. Its only consumer is
  // the audit log (JSON-serialized into a Prisma JSON column), and key names
  // must survive verbatim: the redactor redacts values under their own names.
  return Object.fromEntries(
    Object.entries(record).map(([key, val]) => {
      const redactThis =
        SENSITIVE_KEYS.has(key.toLowerCase()) ||
        isSecretSettingKey(key) ||
        (secretPair && key === 'value');
      return [key, redactThis ? REDACTED : redactSensitive(val, depth + 1)];
    }),
  );
}

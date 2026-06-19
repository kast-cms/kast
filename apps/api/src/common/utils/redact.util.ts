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
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? REDACTED : redactSensitive(val, depth + 1);
    }
    return out;
  }
  return value;
}

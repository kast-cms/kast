/** Secret keys whose name does not end in a recognisable credential suffix. */
const SECRET_SETTING_KEYS = new Set<string>(['smtp.password']);

const SECRET_KEY_SUFFIX =
  /(password|passphrase|secret|api_?key|access_?key|private_?key|signing_?key|encryption_?key|token|credentials?)$/;

/**
 * A setting holds a credential when it is explicitly listed or when its last
 * dot-segment ends in a credential suffix, so a future `*.apiKey` setting is
 * protected the moment it is introduced rather than the moment it is noticed.
 *
 * Lives in `common/` rather than the settings module because the audit-log
 * redactor depends on it too, and `common/` must not import from `modules/`.
 */
export function isSecretSettingKey(key: string): boolean {
  const normalized = key.toLowerCase();
  if (SECRET_SETTING_KEYS.has(normalized)) return true;
  const lastSegment = normalized.split('.').pop() ?? normalized;
  return SECRET_KEY_SUFFIX.test(lastSegment);
}

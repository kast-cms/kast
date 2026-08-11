import type { GlobalSetting } from '@prisma/client';
import { isSecretSettingKey } from '../../common/utils/secret-key.util';
import { enforcedBy } from './settings-catalog';

export { isSecretSettingKey };

export interface SafeSetting extends Omit<GlobalSetting, 'value'> {
  value: GlobalSetting['value'] | null;
  isSecret: boolean;
  configured: boolean;
  /** The runtime path that reads this value; null for caller-defined keys. */
  enforcedBy: string | null;
}

/** True when the stored value is something other than "absent" or "blank". */
function isConfigured(value: GlobalSetting['value']): boolean {
  if (value === null) return false;
  if (typeof value === 'string') return value.length > 0;
  return true;
}

/**
 * Projection used for every settings response. Secret rows keep their metadata
 * so the admin can tell a configured credential from an unset one, but the
 * value itself never leaves the API.
 */
export function toSafeSetting(row: GlobalSetting): SafeSetting {
  const secret = isSecretSettingKey(row.key);
  return {
    ...row,
    value: secret ? null : row.value,
    isSecret: secret,
    configured: isConfigured(row.value),
    enforcedBy: enforcedBy(row.key),
  };
}

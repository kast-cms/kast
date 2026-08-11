export interface GlobalSetting {
  id: string;
  key: string;
  /** Always `null` for a secret setting — credentials are never sent back. */
  value: unknown;
  group: string;
  label: string | null;
  isPublic: boolean;
  updatedAt: string;
  updatedBy: string | null;
  /** True when the key names a credential (e.g. `smtp.password`). */
  isSecret?: boolean;
  /** Whether a secret is stored, so the UI can distinguish set from unset. */
  configured?: boolean;
}

export interface SettingPatchEntry {
  key: string;
  value: unknown;
}

export interface UpdateSettingsBody {
  settings: SettingPatchEntry[];
}

export interface TestSmtpBody {
  to: string;
}

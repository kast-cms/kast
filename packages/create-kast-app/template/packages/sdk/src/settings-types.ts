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
  /** Runtime component that consumes this setting, when it is a built-in key. */
  enforcedBy?: string | null;
}

export interface SettingPatchEntry {
  key: string;
  value: unknown;
  isPublic?: boolean;
}

export interface UpdateSettingsBody {
  settings: SettingPatchEntry[];
}

export interface TestSmtpBody {
  to: string;
}

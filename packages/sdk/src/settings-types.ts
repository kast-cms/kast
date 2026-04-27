export interface GlobalSetting {
  id: string;
  key: string;
  value: unknown;
  group: string;
  label: string | null;
  isPublic: boolean;
  updatedAt: string;
  updatedBy: string | null;
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

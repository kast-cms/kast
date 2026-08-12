export interface PluginRecord {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description: string | null;
  isActive: boolean;
  isInstalled: boolean;
  isSystemPlugin: boolean;
  permissions: string[];
  hooks: string[];
  adminPages: Array<{ label: string; path: string; icon?: string }>;
  env: string[];
  installedAt: string;
  updatedAt: string;
}

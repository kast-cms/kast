export interface PluginRecord {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description: string | null;
  isActive: boolean;
  isSystemPlugin: boolean;
  installedAt: string;
  updatedAt: string;
}

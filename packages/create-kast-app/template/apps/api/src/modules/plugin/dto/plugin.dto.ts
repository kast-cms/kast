import { IsOptional, IsString } from 'class-validator';

export class EnableDisablePluginDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

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

export interface PluginListResponse {
  data: PluginRecord[];
}

export interface UpsertPluginParams {
  name: string;
  displayName: string;
  version: string;
  description?: string;
}

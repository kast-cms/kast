import { IsOptional, IsString, MinLength } from 'class-validator';

export class EnableDisablePluginDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

export class InstallPluginDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  version!: string;
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

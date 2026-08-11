import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateRoleDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  displayName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class PermissionInputDto {
  @ApiProperty()
  @IsString()
  resource!: string;

  @ApiProperty()
  @IsString()
  action!: string;

  @ApiPropertyOptional({ default: '*' })
  @IsOptional()
  @IsString()
  scope?: string;
}

export class AssignPermissionsDto {
  @ApiProperty({ type: [PermissionInputDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PermissionInputDto)
  permissions!: PermissionInputDto[];
}

export interface PermissionResponse {
  id: string;
  resource: string;
  action: string;
  scope: string;
}

export interface RoleSummaryResponse {
  id: string;
  name: string;
  displayName: string;
  isSystem: boolean;
  usersCount: number;
  permissionsCount: number;
}

export interface RoleDetailResponse {
  id: string;
  name: string;
  displayName: string;
  isSystem: boolean;
  permissions: PermissionResponse[];
}

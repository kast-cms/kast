import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  PERMISSION_ACTIONS,
  PERMISSION_RESOURCES,
} from '../../../common/authorization/permission-catalog';

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
  @ApiProperty({ enum: PERMISSION_RESOURCES })
  @IsIn(PERMISSION_RESOURCES)
  resource!: string;

  @ApiProperty({ enum: PERMISSION_ACTIONS })
  @IsIn(PERMISSION_ACTIONS)
  action!: string;

  @ApiPropertyOptional({ default: '*' })
  @IsOptional()
  @IsString()
  scope?: string;
}

export class AssignPermissionsDto {
  @ApiProperty({ type: [PermissionInputDto] })
  @IsArray()
  @ArrayMaxSize(PERMISSION_RESOURCES.length * PERMISSION_ACTIONS.length)
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

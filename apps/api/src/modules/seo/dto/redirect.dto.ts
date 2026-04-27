import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export enum RedirectTypeDto {
  PERMANENT = 'PERMANENT',
  TEMPORARY = 'TEMPORARY',
}

export class CreateRedirectDto {
  @ApiProperty()
  @IsString()
  fromPath!: string;

  @ApiProperty()
  @IsString()
  toPath!: string;

  @ApiPropertyOptional({ enum: RedirectTypeDto })
  @IsOptional()
  @IsEnum(RedirectTypeDto)
  type?: RedirectTypeDto;
}

export class UpdateRedirectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromPath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toPath?: string;

  @ApiPropertyOptional({ enum: RedirectTypeDto })
  @IsOptional()
  @IsEnum(RedirectTypeDto)
  type?: RedirectTypeDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

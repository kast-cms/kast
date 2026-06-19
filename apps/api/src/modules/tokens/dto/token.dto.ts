import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TokenScope } from '@prisma/client';
import { IsEnum, IsISO8601, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateApiTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ enum: TokenScope })
  @IsEnum(TokenScope)
  scope!: TokenScope;

  @ApiPropertyOptional({ description: 'Required when scope is SCOPED' })
  @IsOptional()
  @IsObject()
  scopeData?: Record<string, string[]>;

  @ApiPropertyOptional({ description: 'ISO 8601 expiry' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export interface ApiTokenSummaryResponse {
  id: string;
  name: string;
  prefix: string;
  scope: TokenScope;
  scopeData?: Record<string, string[]>;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface ApiTokenCreatedResponse extends ApiTokenSummaryResponse {
  token: string;
}

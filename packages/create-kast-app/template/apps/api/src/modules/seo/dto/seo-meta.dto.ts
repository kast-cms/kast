import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpsertSeoMetaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  metaTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  metaDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ogTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ogDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ogImageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  twitterTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  twitterDesc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  twitterImageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  canonicalUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  noIndex?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  noFollow?: boolean;
}

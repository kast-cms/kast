import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsISO8601, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateContentEntryDto {
  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  locale: string = 'en';

  @ApiProperty({ description: 'Content data matching the content type fields' })
  @IsObject()
  @Type(() => Object)
  data!: Record<string, unknown>;
}

export class UpdateContentEntryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @Type(() => Object)
  data?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ContentStatus })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}

export class SchedulePublishDto {
  @ApiProperty({ description: 'ISO 8601 datetime to publish at' })
  @IsISO8601()
  publishAt!: string;
}

export class PublishContentDto {
  @ApiPropertyOptional({
    description: 'Publish even when SEO warnings exist (errors still block)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class AddLocaleDto {
  @ApiProperty({ example: 'ar' })
  @IsString()
  locale!: string;

  @ApiProperty({ example: 'مرحبا-بالعالم' })
  @IsString()
  slug!: string;

  @ApiProperty({ description: 'Content data for the new locale' })
  @IsObject()
  @Type(() => Object)
  data!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Locale code to pre-fill data from' })
  @IsOptional()
  @IsString()
  copyFromLocale?: string;
}

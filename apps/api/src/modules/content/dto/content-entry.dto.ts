import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

const SLUG_DESCRIPTION =
  'URL slug for this locale. Normalized to lower case with non-alphanumeric runs folded to hyphens, and unique per locale. Falls back to `data.slug`, then to a generated value.';

/** Guards the request body; each id still goes through the single-entry gates. */
export const MAX_BULK_ENTRY_IDS = 100;

export class CreateContentEntryDto {
  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  locale: string = 'en';

  @ApiPropertyOptional({ example: 'hello-world', description: SLUG_DESCRIPTION })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty({ description: 'Content data matching the content type fields' })
  @IsObject()
  @Type(() => Object)
  data!: Record<string, unknown>;
}

export class UpdateContentEntryDto {
  @ApiPropertyOptional({
    example: 'en',
    description: 'Locale to write; defaults to the first locale on the entry',
  })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ example: 'hello-world', description: SLUG_DESCRIPTION })
  @IsOptional()
  @IsString()
  slug?: string;

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

export class BulkEntryActionDto {
  @ApiProperty({
    description: `Entry ids to act on (max ${MAX_BULK_ENTRY_IDS}).`,
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_BULK_ENTRY_IDS)
  @IsString({ each: true })
  ids!: string[];
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

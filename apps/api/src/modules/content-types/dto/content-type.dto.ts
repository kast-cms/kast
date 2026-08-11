import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentFieldType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const LOCALIZED_DESCRIPTION =
  'Entries of a localized type are created with a row for every active locale and are validated per locale.';

export class CreateContentTypeDto {
  @ApiProperty({ example: 'blog_post' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'Blog Post' })
  @IsString()
  displayName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: LOCALIZED_DESCRIPTION, default: false })
  @IsOptional()
  @IsBoolean()
  isLocalized?: boolean;
}

export class UpdateContentTypeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: LOCALIZED_DESCRIPTION })
  @IsOptional()
  @IsBoolean()
  isLocalized?: boolean;
}

export class ReorderFieldsDto {
  @ApiProperty({
    description: 'Every field name on the type, in the desired order.',
    example: ['title', 'slug', 'body'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  order!: string[];
}

export class CreateFieldDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  displayName!: string;

  @ApiProperty({ enum: ContentFieldType })
  @IsEnum(ContentFieldType)
  type!: ContentFieldType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isLocalized?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isUnique?: boolean;

  @ApiPropertyOptional({
    description: 'Hidden fields are readable but not writable through the content API.',
  })
  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;

  @ApiPropertyOptional({
    description:
      'Per-type validation rules enforced on every content write, e.g. { minLength, maxLength, regex } for TEXT, { min, max, isInteger } for NUMBER, { choices } for SELECT.',
    example: { minLength: 3, maxLength: 120 },
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Applied when an entry or locale is created without a value for this field.',
  })
  @IsOptional()
  defaultValue?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  position?: number;
}

export class UpdateFieldDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isLocalized?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isUnique?: boolean;

  @ApiPropertyOptional({
    description: 'Hidden fields are readable but not writable through the content API.',
  })
  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;

  @ApiPropertyOptional({
    description:
      'Per-type validation rules enforced on every content write. Replaces the stored config wholesale.',
    example: { minLength: 3, maxLength: 120 },
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Applied when an entry or locale is created without a value for this field.',
  })
  @IsOptional()
  defaultValue?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  position?: number;
}

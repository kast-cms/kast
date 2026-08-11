import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FormFieldType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { toBoolean } from '../../../common/dto/to-boolean.transform';

export class FormFieldDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  label!: string;

  @ApiProperty({ enum: FormFieldType })
  @IsEnum(FormFieldType)
  type!: FormFieldType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  isRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class CreateFormDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  notifyEmail?: string;

  @ApiProperty({ type: [FormFieldDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields!: FormFieldDto[];
}

export class UpdateFormDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  notifyEmail?: string;

  @ApiPropertyOptional({ type: [FormFieldDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields?: FormFieldDto[];
}

export class SubmitFormDto {
  @ApiProperty()
  @IsObject()
  data!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Honeypot field — leave empty' })
  @IsOptional()
  @IsString()
  _hp?: string;
}

export class MarkSubmissionReadDto {
  @ApiPropertyOptional({ default: true, description: 'Defaults to true' })
  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  isRead?: boolean;
}

export class ListSubmissionsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number;
}

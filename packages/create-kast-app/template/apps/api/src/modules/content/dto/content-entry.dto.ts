import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsISO8601, IsObject, IsOptional, IsString } from 'class-validator';

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

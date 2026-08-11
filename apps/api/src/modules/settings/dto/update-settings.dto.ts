import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { Allow, IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { toBoolean } from '../../../common/dto/to-boolean.transform';

class SettingEntryDto {
  @ApiProperty({ description: 'Setting key (e.g. site.name)' })
  @IsString()
  key!: string;

  // @Allow keeps the whitelisting ValidationPipe from stripping this arbitrary
  // JSON value (it has no type-specific validator of its own).
  @ApiProperty({ description: 'Setting value (any JSON-serialisable type)' })
  @Allow()
  value!: unknown;

  @ApiProperty({
    required: false,
    description:
      'Publish the setting through the public delivery endpoint. Omit to leave the current visibility alone; secret keys stay private regardless.',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  isPublic?: boolean;
}

export class UpdateSettingsDto {
  @ApiProperty({ type: [SettingEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SettingEntryDto)
  settings!: SettingEntryDto[];
}

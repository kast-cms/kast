import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsString, ValidateNested } from 'class-validator';

class SettingEntryDto {
  @ApiProperty({ description: 'Setting key (e.g. site.name)' })
  @IsString()
  key!: string;

  @ApiProperty({ description: 'Setting value (any JSON-serialisable type)' })
  value!: unknown;
}

export class UpdateSettingsDto {
  @ApiProperty({ type: [SettingEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SettingEntryDto)
  settings!: SettingEntryDto[];
}

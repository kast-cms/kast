import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { toBoolean } from '../../../common/dto/to-boolean.transform';

export class CreateLocaleDto {
  @IsString()
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/, {
    message: 'code must be a BCP-47 language tag like "en" or "fr-FR"',
  })
  code!: string;

  @IsString()
  @Length(1, 80)
  name!: string;

  @IsString()
  @Length(1, 80)
  nativeName!: string;

  @IsOptional()
  @IsIn(['LTR', 'RTL'])
  direction?: 'LTR' | 'RTL';

  @IsOptional()
  @IsString()
  fallbackCode?: string;
}

export class UpdateLocaleDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  nativeName?: string;

  @IsOptional()
  @IsIn(['LTR', 'RTL'])
  direction?: 'LTR' | 'RTL';

  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  isActive?: boolean;

  @IsOptional()
  @IsString()
  fallbackCode?: string;
}

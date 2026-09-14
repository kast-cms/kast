import { IsString, Length, Matches } from 'class-validator';

export class TwoFactorCodeDto {
  @IsString()
  @Length(6, 64)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  code!: string;
}

export class VerifyTwoFactorDto extends TwoFactorCodeDto {
  @IsString()
  @Length(43, 43)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  challengeToken!: string;
}

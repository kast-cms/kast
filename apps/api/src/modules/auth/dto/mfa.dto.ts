import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class VerifyMfaSetupDto {
  @ApiProperty({ description: 'Base32 TOTP secret returned by setup start' })
  @IsString()
  @MinLength(16)
  secret!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  code!: string;
}

export class VerifyMfaChallengeDto {
  @ApiProperty()
  @IsString()
  challengeToken!: string;

  @ApiProperty({ description: 'Six-digit TOTP code or one recovery code' })
  @IsString()
  code!: string;
}

export class DisableMfaDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty({ description: 'Six-digit TOTP code or one recovery code' })
  @IsString()
  code!: string;
}

export class MfaCodeDto {
  @ApiProperty({ description: 'Six-digit TOTP code or one recovery code' })
  @IsString()
  code!: string;
}

export class RevokeSessionDto {
  @ApiPropertyOptional({ description: 'Keep the current browser session when possible' })
  @IsOptional()
  keepCurrent?: boolean;
}

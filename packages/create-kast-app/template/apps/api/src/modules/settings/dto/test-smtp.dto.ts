import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class TestSmtpDto {
  @ApiProperty({
    example: 'admin@example.com',
    description: 'Recipient address for the test email',
  })
  @IsEmail()
  to!: string;
}

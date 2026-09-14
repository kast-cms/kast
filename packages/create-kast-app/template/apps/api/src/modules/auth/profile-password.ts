import { BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { UpdateProfileDto } from './dto/update-profile.dto';

export async function verifyProfilePassword(
  passwordHash: string | null,
  dto: UpdateProfileDto,
): Promise<void> {
  if (!dto.newPassword) return;
  if (!dto.currentPassword)
    throw new BadRequestException('currentPassword is required to change password');
  if (!passwordHash || !(await argon2.verify(passwordHash, dto.currentPassword)))
    throw new BadRequestException('Current password is incorrect');
}

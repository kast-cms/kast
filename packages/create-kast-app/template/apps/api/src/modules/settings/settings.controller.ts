import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth.types';
import { TestSmtpDto } from './dto/test-smtp.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import type { SafeSetting } from './settings-secret.util';
import { SettingsService, type StorageProbeResult } from './settings.service';

@ApiTags('settings')
@Controller({ path: 'settings', version: '1' })
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.VIEWER, SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all global settings' })
  getAll(@CurrentUser() user: AuthUser): Promise<{ data: SafeSetting[] }> {
    return this.service.getAll(user).then((data) => ({ data }));
  }

  @Patch()
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update global settings (super_admin only)' })
  patch(
    @Body() dto: UpdateSettingsDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: SafeSetting[] }> {
    return this.service.patch(dto, user).then((data) => ({ data }));
  }

  @Post('test-smtp')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a test email using configured SMTP settings' })
  testSmtp(@Body() dto: TestSmtpDto): Promise<{ success: boolean }> {
    return this.service.testSmtp(dto);
  }

  @Post('test-storage')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Write, read back and delete a probe object in the storage backend' })
  testStorage(): Promise<StorageProbeResult> {
    return this.service.testStorage();
  }
}

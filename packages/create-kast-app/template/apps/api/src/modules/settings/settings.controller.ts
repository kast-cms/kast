import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { GlobalSetting } from '@prisma/client';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth.types';
import { TestSmtpDto } from './dto/test-smtp.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller({ path: 'settings', version: '1' })
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.VIEWER, SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all global settings' })
  getAll(): Promise<{ data: GlobalSetting[] }> {
    return this.service.getAll().then((data) => ({ data }));
  }

  @Patch()
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update global settings (super_admin only)' })
  patch(
    @Body() dto: UpdateSettingsDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: GlobalSetting[] }> {
    return this.service.patch(dto, user.id).then((data) => ({ data }));
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
  @ApiOperation({ summary: 'Verify configured storage provider' })
  testStorage(): Promise<{ provider: string; status: string }> {
    return this.service.testStorage();
  }
}

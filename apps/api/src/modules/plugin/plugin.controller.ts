import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { Roles } from '../../common/decorators/roles.decorator';
import type { PluginListResponse, PluginRecord } from './dto/plugin.dto';
import { PluginService } from './plugin.service';

@ApiTags('plugins')
@Controller({ path: 'plugins', version: '1' })
@ApiBearerAuth()
export class PluginController {
  constructor(private readonly service: PluginService) {}

  @Get()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'List installed plugins' })
  list(): Promise<PluginListResponse> {
    return this.service.list();
  }

  @Post(':name/enable')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable a plugin (takes effect on next restart)' })
  enable(@Param('name') name: string): Promise<{ data: PluginRecord }> {
    return this.service.enable(name);
  }

  @Post(':name/disable')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable a plugin (takes effect on next restart)' })
  disable(@Param('name') name: string): Promise<{ data: PluginRecord }> {
    return this.service.disable(name);
  }
}

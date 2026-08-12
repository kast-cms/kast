import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { Roles } from '../../common/decorators/roles.decorator';
import { InstallPluginDto, type PluginListResponse, type PluginRecord } from './dto/plugin.dto';
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

  @Post('install')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Install a plugin by name and version' })
  install(@Body() dto: InstallPluginDto): Promise<{ data: PluginRecord }> {
    return this.service.install(dto.name, dto.version);
  }

  @Delete(':name')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Uninstall a plugin' })
  async uninstall(@Param('name') name: string): Promise<void> {
    await this.service.uninstall(name);
  }

  @Post(':name/enable')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable a plugin immediately' })
  enable(@Param('name') name: string): Promise<{ data: PluginRecord }> {
    return this.service.enable(name);
  }

  @Post(':name/disable')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable a plugin immediately' })
  disable(@Param('name') name: string): Promise<{ data: PluginRecord }> {
    return this.service.disable(name);
  }

  @Get(':name/config')
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get persisted configuration for a plugin' })
  getConfig(@Param('name') name: string): Promise<{ data: Record<string, unknown> }> {
    return this.service.getConfig(name);
  }

  @Patch(':name/config')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update persisted configuration for a plugin' })
  updateConfig(
    @Param('name') name: string,
    @Body() body: Record<string, unknown>,
  ): Promise<{ data: Record<string, unknown> }> {
    return this.service.updateConfig(name, body);
  }
}

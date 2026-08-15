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
import { RegisterPluginDto, type PluginListResponse, type PluginRecord } from './dto/plugin.dto';
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

  @Post('register')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Register a plugin already bundled with this deployment',
    description:
      "Records a plugin that is present in the deployment's plugins/ directory so it can be " +
      'enabled. This endpoint fetches nothing: there is no registry download, no artifact ' +
      'verification, and no write to disk. To add a plugin that is not bundled, place it in ' +
      'plugins/ and rebuild the image.',
  })
  register(@Body() dto: RegisterPluginDto): Promise<{ data: PluginRecord }> {
    return this.service.register(dto.name, dto.version);
  }

  @Delete(':name')
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Deregister a plugin',
    description:
      'Unloads the plugin and clears its registration. The code stays on disk; only the record ' +
      'and the running instance are removed.',
  })
  async deregister(@Param('name') name: string): Promise<void> {
    await this.service.deregister(name);
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

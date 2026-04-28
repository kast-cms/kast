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
import type { Locale } from '@prisma/client';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateLocaleDto, UpdateLocaleDto } from './dto/locale.dto';
import { LocalesService } from './locales.service';

@ApiTags('locales')
@Controller({ path: 'locales', version: '1' })
export class LocalesController {
  constructor(private readonly service: LocalesService) {}

  @Get()
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.VIEWER, SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all configured locales' })
  list(): Promise<{ data: Locale[] }> {
    return this.service.findAll().then((data) => ({ data }));
  }

  @Post()
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new locale' })
  create(@Body() dto: CreateLocaleDto): Promise<{ data: Locale }> {
    return this.service.create(dto).then((data) => ({ data }));
  }

  @Patch(':code')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a locale' })
  update(@Param('code') code: string, @Body() dto: UpdateLocaleDto): Promise<{ data: Locale }> {
    return this.service.update(code, dto).then((data) => ({ data }));
  }

  @Post(':code/set-default')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Set a locale as the default' })
  setDefault(@Param('code') code: string): Promise<{ data: Locale }> {
    return this.service.setDefault(code).then((data) => ({ data }));
  }

  @Delete(':code')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a non-default locale' })
  async delete(@Param('code') code: string): Promise<void> {
    await this.service.delete(code);
  }
}

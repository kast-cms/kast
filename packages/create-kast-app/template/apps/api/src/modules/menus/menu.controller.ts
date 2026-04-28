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
import type { Menu, MenuItem } from '@prisma/client';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateMenuDto,
  CreateMenuItemDto,
  ReorderMenuItemsDto,
  UpdateMenuDto,
  UpdateMenuItemDto,
} from './dto/menu.dto';
import type { MenuDetail, MenuSummary } from './menu.repository';
import { MenuService } from './menu.service';

@ApiTags('menus')
@Controller({ path: 'menus', version: '1' })
export class MenuController {
  constructor(private readonly service: MenuService) {}

  @Get()
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.VIEWER, SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all menus' })
  list(): Promise<MenuSummary[]> {
    return this.service.list();
  }

  @Post()
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a menu' })
  create(@Body() dto: CreateMenuDto): Promise<Menu> {
    return this.service.create(dto);
  }

  @Get(':handle')
  @Public()
  @ApiOperation({ summary: 'Get full menu tree by slug handle (public)' })
  findByHandle(@Param('handle') handle: string): Promise<MenuDetail> {
    return this.service.findBySlug(handle);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a menu' })
  update(@Param('id') id: string, @Body() dto: UpdateMenuDto): Promise<Menu> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a menu' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.service.delete(id);
  }

  @Post(':id/items')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Add a menu item' })
  addItem(@Param('id') id: string, @Body() dto: CreateMenuItemDto): Promise<MenuItem> {
    return this.service.addItem(id, dto);
  }

  @Patch(':id/items/:itemId')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a menu item' })
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMenuItemDto,
  ): Promise<MenuItem> {
    return this.service.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a menu item' })
  async deleteItem(@Param('id') id: string, @Param('itemId') itemId: string): Promise<void> {
    await this.service.deleteItem(id, itemId);
  }

  @Post(':id/items/reorder')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Batch reorder menu items' })
  async reorder(@Param('id') id: string, @Body() dto: ReorderMenuItemsDto): Promise<void> {
    await this.service.reorder(id, dto);
  }
}

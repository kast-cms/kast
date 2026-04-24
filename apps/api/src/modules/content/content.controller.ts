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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser, PaginatedResult } from '../../common/types/auth.types';
import type { EntryWithLocale } from './content.repository';
import { ContentService } from './content.service';
import { CreateContentEntryDto, UpdateContentEntryDto } from './dto/content-entry.dto';
import { ContentQueryDto } from './dto/content-query.dto';

@ApiTags('content')
@Controller({ path: 'content-types/:typeSlug/entries', version: '1' })
export class ContentController {
  constructor(private readonly service: ContentService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List entries for a content type' })
  findAll(
    @Param('typeSlug') typeSlug: string,
    @Query() query: ContentQueryDto,
  ): Promise<PaginatedResult<EntryWithLocale>> {
    return this.service.findAll(typeSlug, query);
  }

  @Post()
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a content entry' })
  create(
    @Param('typeSlug') typeSlug: string,
    @Body() dto: CreateContentEntryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: EntryWithLocale }> {
    return this.service.create(typeSlug, dto, user.id);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a content entry by ID' })
  findOne(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
    @Query('locale') locale?: string,
  ): Promise<{ data: EntryWithLocale }> {
    return this.service.findOne(typeSlug, id, locale);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a content entry' })
  update(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
    @Body() dto: UpdateContentEntryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: EntryWithLocale }> {
    return this.service.update(typeSlug, id, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Trash a content entry' })
  remove(@Param('typeSlug') typeSlug: string, @Param('id') id: string): Promise<void> {
    return this.service.trash(typeSlug, id);
  }

  @Post(':id/publish')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Publish a content entry' })
  publish(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
  ): Promise<{ data: EntryWithLocale }> {
    return this.service.publish(typeSlug, id);
  }
}

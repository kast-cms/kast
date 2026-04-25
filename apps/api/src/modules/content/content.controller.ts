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
import {
  CreateContentEntryDto,
  SchedulePublishDto,
  UpdateContentEntryDto,
} from './dto/content-entry.dto';
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

  @Post(':id/unpublish')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Unpublish a content entry' })
  unpublish(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
  ): Promise<{ data: EntryWithLocale }> {
    return this.service.unpublish(typeSlug, id);
  }

  @Post(':id/archive')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Archive a content entry' })
  archive(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
  ): Promise<{ data: EntryWithLocale }> {
    return this.service.archive(typeSlug, id);
  }

  @Post(':id/restore')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Restore an archived entry to draft' })
  restore(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
  ): Promise<{ data: EntryWithLocale }> {
    return this.service.restore(typeSlug, id);
  }

  @Post(':id/schedule')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Schedule a content entry for future publication' })
  schedulePublish(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
    @Body() dto: SchedulePublishDto,
  ): Promise<{ data: EntryWithLocale }> {
    return this.service.schedulePublish(typeSlug, id, dto);
  }

  @Delete(':id/schedule')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Cancel a scheduled publication' })
  cancelSchedule(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
  ): Promise<{ data: EntryWithLocale }> {
    return this.service.cancelSchedule(typeSlug, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Trash a content entry' })
  remove(@Param('typeSlug') typeSlug: string, @Param('id') id: string): Promise<void> {
    return this.service.trash(typeSlug, id);
  }
}

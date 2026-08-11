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
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser, PaginatedResult } from '../../common/types/auth.types';
import { ContentTypesService } from '../content-types/content-types.service';
import type { BulkEntryOutcome } from './content-bulk.ops';
import {
  toEntryDetail,
  toEntrySummary,
  type ContentEntryDetailResponse,
  type ContentEntrySummaryResponse,
} from './content.presenter';
import type { EntryWithLocale, VersionWithAuthor } from './content.repository';
import { ContentService } from './content.service';
import {
  AddLocaleDto,
  BulkEntryActionDto,
  CreateContentEntryDto,
  PublishContentDto,
  SchedulePublishDto,
  UpdateContentEntryDto,
} from './dto/content-entry.dto';
import { ContentQueryDto } from './dto/content-query.dto';

@ApiTags('content')
@Controller({ path: 'content-types/:typeSlug/entries', version: '1' })
export class ContentController {
  constructor(
    private readonly service: ContentService,
    private readonly contentTypes: ContentTypesService,
  ) {}

  @Get()
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.VIEWER, SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'List entries for a content type' })
  async findAll(
    @Param('typeSlug') typeSlug: string,
    @Query() query: ContentQueryDto,
  ): Promise<PaginatedResult<ContentEntrySummaryResponse>> {
    const [ct, page] = await Promise.all([
      this.contentTypes.findByName(typeSlug),
      this.service.findAll(typeSlug, query),
    ]);
    return { ...page, data: page.data.map((e) => toEntrySummary(e, ct.fields, query.locale)) };
  }

  @Post()
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a content entry' })
  async create(
    @Param('typeSlug') typeSlug: string,
    @Body() dto: CreateContentEntryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: ContentEntryDetailResponse }> {
    const { data } = await this.service.create(typeSlug, dto, user.id);
    return { data: toEntryDetail(data, dto.locale) };
  }

  @Post('bulk/trash')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Trash several entries',
    description:
      'Per-item and not atomic: every id is reported on its own and failures do not roll back the entries that succeeded.',
  })
  bulkTrash(
    @Param('typeSlug') typeSlug: string,
    @Body() dto: BulkEntryActionDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: BulkEntryOutcome }> {
    return this.service.bulkTrash(typeSlug, dto.ids, user.id);
  }

  @Post('bulk/publish')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Publish several entries (each runs the schema and SEO gates)',
    description:
      'Per-item and not atomic: every id is reported on its own and failures do not roll back the entries that succeeded.',
  })
  bulkPublish(
    @Param('typeSlug') typeSlug: string,
    @Body() dto: BulkEntryActionDto,
  ): Promise<{ data: BulkEntryOutcome }> {
    return this.service.bulkPublish(typeSlug, dto.ids);
  }

  @Post('bulk/unpublish')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Unpublish several entries',
    description:
      'Per-item and not atomic: every id is reported on its own and failures do not roll back the entries that succeeded.',
  })
  bulkUnpublish(
    @Param('typeSlug') typeSlug: string,
    @Body() dto: BulkEntryActionDto,
  ): Promise<{ data: BulkEntryOutcome }> {
    return this.service.bulkUnpublish(typeSlug, dto.ids);
  }

  @Get(':id')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.VIEWER, SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a content entry by ID' })
  async findOne(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
    @Query('locale') locale?: string,
  ): Promise<{ data: ContentEntryDetailResponse }> {
    const { data } = await this.service.findOne(typeSlug, id, locale);
    return { data: toEntryDetail(data, locale) };
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
  ): Promise<{ data: ContentEntryDetailResponse }> {
    return this.present(this.service.update(typeSlug, id, dto, user.id), dto.locale);
  }

  @Post(':id/publish')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Publish a content entry (runs SEO gate)' })
  publish(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
    @Body() dto: PublishContentDto,
  ): Promise<{ data: ContentEntryDetailResponse }> {
    return this.present(this.service.publish(typeSlug, id, dto));
  }

  @Post(':id/locale')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Add a locale to an existing entry' })
  addLocale(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
    @Body() dto: AddLocaleDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: ContentEntryDetailResponse }> {
    return this.present(this.service.addLocale(typeSlug, id, dto, user.id), dto.locale);
  }

  @Post(':id/unpublish')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Unpublish a content entry' })
  unpublish(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
  ): Promise<{ data: ContentEntryDetailResponse }> {
    return this.present(this.service.unpublish(typeSlug, id));
  }

  @Post(':id/archive')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Archive a content entry' })
  archive(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
  ): Promise<{ data: ContentEntryDetailResponse }> {
    return this.present(this.service.archive(typeSlug, id));
  }

  @Post(':id/unarchive')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Move an archived entry back to draft',
    description:
      'Not trash restoration: a trashed entry is brought back with POST /api/v1/trash/content/:id/restore.',
  })
  unarchive(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
  ): Promise<{ data: ContentEntryDetailResponse }> {
    return this.present(this.service.unarchive(typeSlug, id));
  }

  @Post(':id/restore')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({
    deprecated: true,
    summary: 'Deprecated alias for :id/unarchive',
    description: 'Kept for existing clients. Trash restoration lives under /api/v1/trash.',
  })
  restore(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
  ): Promise<{ data: ContentEntryDetailResponse }> {
    return this.present(this.service.unarchive(typeSlug, id));
  }

  @Post(':id/schedule')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Schedule a content entry for future publication' })
  schedulePublish(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
    @Body() dto: SchedulePublishDto,
  ): Promise<{ data: ContentEntryDetailResponse }> {
    return this.present(this.service.schedulePublish(typeSlug, id, dto));
  }

  @Delete(':id/schedule')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Cancel a scheduled publication' })
  cancelSchedule(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
  ): Promise<{ data: ContentEntryDetailResponse }> {
    return this.present(this.service.cancelSchedule(typeSlug, id));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Trash a content entry' })
  remove(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.service.trash(typeSlug, id, user.id);
  }

  @Get(':id/versions')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'List version history for a content entry' })
  listVersions(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<PaginatedResult<VersionWithAuthor>> {
    return this.service.listVersions(typeSlug, id, Number(limit ?? 20), cursor);
  }

  @Get(':id/versions/:versionId')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a specific version snapshot' })
  getVersion(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ): Promise<{ data: VersionWithAuthor }> {
    return this.service.getVersion(typeSlug, id, versionId);
  }

  @Post(':id/versions/:versionId/revert')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Revert a content entry to a previous version' })
  revertToVersion(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: ContentEntryDetailResponse }> {
    return this.present(this.service.revertToVersion(typeSlug, id, versionId, user.id));
  }

  private async present(
    write: Promise<{ data: EntryWithLocale }>,
    locale?: string,
  ): Promise<{ data: ContentEntryDetailResponse }> {
    const { data } = await write;
    return { data: toEntryDetail(data, locale) };
  }
}

/* eslint-disable max-lines */
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
import { AuditAction } from '../../common/decorators/audit-action.decorator';
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
  ImportContentDto,
  ImportWordPressDto,
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
  @AuditAction('content.bulk_trash')
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
  @AuditAction('content.bulk_publish')
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
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: BulkEntryOutcome }> {
    return this.service.bulkPublish(typeSlug, dto.ids, user);
  }

  @Post('bulk/unpublish')
  @AuditAction('content.bulk_unpublish')
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

  @Get('export')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Export all entries for a content type as JSON' })
  exportType(@Param('typeSlug') typeSlug: string): ReturnType<ContentService['exportType']> {
    return this.service.exportType(typeSlug);
  }

  @Post('import')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Import entries from a Kast JSON export' })
  importType(
    @Param('typeSlug') typeSlug: string,
    @Body() dto: ImportContentDto,
    @CurrentUser() user: AuthUser,
  ): ReturnType<ContentService['importType']> {
    return this.service.importType(typeSlug, dto, user.id);
  }

  @Post('import/wordpress')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Import WordPress REST JSON posts into this content type' })
  importWordPress(
    @Param('typeSlug') typeSlug: string,
    @Body() dto: ImportWordPressDto,
    @CurrentUser() user: AuthUser,
  ): ReturnType<ContentService['importWordPress']> {
    return this.service.importWordPress(typeSlug, dto, user.id);
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
  @AuditAction('content.publish')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Publish a content entry (runs SEO gate)' })
  publish(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
    @Body() dto: PublishContentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: ContentEntryDetailResponse }> {
    return this.present(this.service.publish(typeSlug, id, dto, user));
  }

  @Post(':id/locale')
  @AuditAction('content.add_locale')
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
  @AuditAction('content.unpublish')
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
  @AuditAction('content.archive')
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
  @AuditAction('content.unarchive')
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
  @AuditAction('content.unarchive')
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
  @AuditAction('content.schedule')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Schedule a content entry for future publication' })
  schedulePublish(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
    @Body() dto: SchedulePublishDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: ContentEntryDetailResponse }> {
    return this.present(this.service.schedulePublish(typeSlug, id, dto, user));
  }

  @Delete(':id/schedule')
  @AuditAction('content.cancel_schedule')
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
  @AuditAction('content.revert')
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

  @Get(':id/versions/:versionId/diff')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Diff a saved version against the current entry data' })
  diffVersion(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Query('locale') locale?: string,
  ): ReturnType<ContentService['diffVersion']> {
    return this.service.diffVersion(typeSlug, id, versionId, locale);
  }

  @Post(':id/review/submit')
  @AuditAction('content.review_submit')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Submit a content entry for review' })
  submitForReview(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: ContentEntryDetailResponse }> {
    return this.present(this.service.submitForReview(typeSlug, id, user.id));
  }

  @Post(':id/review/approve')
  @AuditAction('content.review_approve')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve a content entry for publishing' })
  approveReview(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: ContentEntryDetailResponse }> {
    return this.present(this.service.approveReview(typeSlug, id, user.id));
  }

  @Post(':id/review/changes')
  @AuditAction('content.review_changes')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Request changes on a content entry under review' })
  requestChanges(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: ContentEntryDetailResponse }> {
    return this.present(this.service.requestChanges(typeSlug, id, user.id));
  }

  @Post(':id/lock')
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Acquire or renew an edit lock for an entry' })
  acquireLock(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ data: ContentEntryDetailResponse }> {
    return this.present(this.service.acquireLock(typeSlug, id, user.id));
  }

  @Delete(':id/lock')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Release the current user edit lock for an entry' })
  releaseLock(
    @Param('typeSlug') typeSlug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.service.releaseLock(typeSlug, id, user.id);
  }

  private async present(
    write: Promise<{ data: EntryWithLocale }>,
    locale?: string,
  ): Promise<{ data: ContentEntryDetailResponse }> {
    const { data } = await write;
    return { data: toEntryDetail(data, locale) };
  }
}
